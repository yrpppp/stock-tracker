import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Stock } from './entities/stock.entity';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StocksService {
  private readonly logger = new Logger(StocksService.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private readonly kisBaseUrl: string;
  private readonly kisAppKey: string;
  private readonly kisAppSecret: string;

  // 종목명 캐시 (메모리)
  private readonly stockNameCache: Map<string, string> = new Map();

  constructor(
    @InjectRepository(Stock)
    private stockRepository: Repository<Stock>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.kisBaseUrl = this.configService.get<string>(
      'KIS_BASE_URL',
      'https://openapivts.koreainvestment.com:29443',
    );
    this.kisAppKey = this.configService.get<string>('KIS_APP_KEY', '');
    this.kisAppSecret = this.configService.get<string>('KIS_APP_SECRET', '');
  }

  /**
   * KIS OAuth 토큰 발급 (24시간 유효)
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    this.logger.log('KIS Access Token 발급 요청...');

    try {
      const response = await lastValueFrom(
        this.httpService.post(`${this.kisBaseUrl}/oauth2/tokenP`, {
          grant_type: 'client_credentials',
          appkey: this.kisAppKey,
          appsecret: this.kisAppSecret,
        }),
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
      this.logger.log('KIS Access Token 발급 성공');
      return this.accessToken!;
    } catch (error) {
      this.logger.error('KIS Access Token 발급 실패', error.message);
      throw new Error('KIS API 인증 실패. APP_KEY와 APP_SECRET을 확인하세요.');
    }
  }

  private isKoreanStock(symbol: string): boolean {
    const cleaned = symbol.replace(/\.(KS|KQ)$/i, '');
    return /^\d{6}$/.test(cleaned);
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.replace(/\.(KS|KQ)$/i, '');
  }

  /**
   * 국내 주식 종목명 조회 (KIS API: v1_국내주식-029)
   * TR ID: CTPF1604R
   */
  private async fetchKoreanStockName(symbol: string, token: string): Promise<string> {
    if (this.stockNameCache.has(symbol)) {
      return this.stockNameCache.get(symbol)!;
    }

    try {
      const url = `${this.kisBaseUrl}/uapi/domestic-stock/v1/quotations/search-info`;
      const response = await lastValueFrom(
        this.httpService.get(url, {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${token}`,
            appkey: this.kisAppKey,
            appsecret: this.kisAppSecret,
            tr_id: 'CTPF1604R',
            custtype: 'P',
          },
          params: {
            PRDT_TYPE_CD: '300', // 주식
            PDNO: symbol,
          },
        }),
      );

      const name = response.data.output?.prdt_abrv_name || response.data.output?.prdt_name || symbol;
      this.stockNameCache.set(symbol, name);
      return name;
    } catch (error) {
      this.logger.warn(`Failed to fetch Korean stock name for ${symbol}: ${error.message}`);
      return symbol;
    }
  }

  /**
   * 국내 주식 현재가 조회 (KIS API: v1_국내주식-008)
   */
  private async fetchKoreanStockPrice(
    symbol: string,
    token: string,
  ): Promise<{ currentPrice: number; stockName: string; currency: string }> {
    const url = `${this.kisBaseUrl}/uapi/domestic-stock/v1/quotations/inquire-price`;

    const response = await lastValueFrom(
      this.httpService.get(url, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${token}`,
          appkey: this.kisAppKey,
          appsecret: this.kisAppSecret,
          tr_id: 'FHKST01010100',
          custtype: 'P',
        },
        params: {
          fid_cond_mrkt_div_code: 'J',
          fid_input_iscd: symbol,
        },
      }),
    );

    const output = response.data.output;
    if (!output) {
      throw new Error(`국내 주식 시세 조회 실패: ${symbol}`);
    }

    // 종목명 결정: 캐시 -> API(search-info) -> 현재가 API 필드 순
    let stockName = symbol;
    if (this.stockNameCache.has(symbol)) {
      stockName = this.stockNameCache.get(symbol)!;
    } else {
      // 비동기로 종목명을 가져와서 캐시 채우기 (현재 요청에서는 실시간으로 기다림)
      stockName = await this.fetchKoreanStockName(symbol, token);
    }

    return {
      currentPrice: parseFloat(output.stck_prpr) || 0,
      stockName,
      currency: 'KRW',
    };
  }

  /**
   * 해외 주식 현재가 조회 (KIS API)
   */
  private async fetchOverseasStockPrice(
    symbol: string,
    token: string,
  ): Promise<{ currentPrice: number; stockName: string; currency: string }> {
    const url = `${this.kisBaseUrl}/uapi/overseas-price/v1/quotations/price`;

    const response = await lastValueFrom(
      this.httpService.get(url, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${token}`,
          appkey: this.kisAppKey,
          appsecret: this.kisAppSecret,
          tr_id: 'HHDFS00000300',
          custtype: 'P',
        },
        params: {
          AUTH: '',
          EXCD: 'NAS', // 기본 나스닥
          SYMB: symbol,
        },
      }),
    );

    const output = response.data.output;
    if (!output) {
      throw new Error(`해외 주식 시세 조회 실패: ${symbol}`);
    }

    const stockName = output.name || symbol;
    if (!this.stockNameCache.has(symbol)) {
      this.stockNameCache.set(symbol, stockName);
    }

    return {
      currentPrice: parseFloat(output.last) || 0,
      stockName,
      currency: 'USD',
    };
  }

  async create(createStockDto: CreateStockDto) {
    if (!createStockDto.userId) {
      createStockDto.userId = 'default_user';
    }
    const stock = this.stockRepository.create(createStockDto);
    return await this.stockRepository.save(stock);
  }

  async findAll(userId: string = 'default_user') {
    const stocks = await this.stockRepository.find({ where: { userId } });

    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (error) {
      this.logger.error('토큰 발급 실패, 가격 0으로 반환', error.message);
      return stocks.map((stock) => ({
        ...stock,
        currentPrice: 0,
        stockName: stock.symbol,
        currency: 'KRW',
        exchangeRate: 1400,
        returnRate: '0.00%',
      }));
    }

    let exchangeRate = 1400;
    try {
      const exRes = await lastValueFrom(
        this.httpService.get('https://open.er-api.com/v6/latest/USD'),
      );
      if (exRes.data?.rates?.KRW) {
        exchangeRate = exRes.data.rates.KRW;
      }
    } catch (e) {
      this.logger.warn('Failed to fetch exchange rate, using default 1400', e.message);
    }

    const stocksWithCurrentPrice = await Promise.all(
      stocks.map(async (stock) => {
        let currentPrice = 0;
        let stockName = this.stockNameCache.get(this.normalizeSymbol(stock.symbol)) || stock.symbol;
        let currency = 'KRW';

        try {
          const normalizedSymbol = this.normalizeSymbol(stock.symbol);
          const isKorean = this.isKoreanStock(stock.symbol);

          if (isKorean) {
            const result = await this.fetchKoreanStockPrice(normalizedSymbol, token);
            currentPrice = result.currentPrice;
            stockName = result.stockName;
            currency = result.currency;
          } else {
            const result = await this.fetchOverseasStockPrice(normalizedSymbol, token);
            currentPrice = result.currentPrice;
            stockName = result.stockName;
            currency = result.currency;
          }
        } catch (error) {
          this.logger.error(`Failed to fetch price for ${stock.symbol}: ${error.message}`);
        }

        const returnRate = currentPrice
          ? ((currentPrice - stock.purchasePrice) / stock.purchasePrice) * 100
          : 0;

        return {
          ...stock,
          currentPrice,
          stockName: stockName || stock.symbol,
          currency,
          exchangeRate,
          returnRate: returnRate.toFixed(2) + '%',
        };
      }),
    );

    return stocksWithCurrentPrice;
  }

  async findOne(id: number) {
    const stock = await this.stockRepository.findOneBy({ id });
    if (!stock) throw new NotFoundException('Stock not found');
    return stock;
  }

  async update(id: number, updateStockDto: UpdateStockDto) {
    await this.stockRepository.update(id, updateStockDto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.stockRepository.delete(id);
    return { deleted: true };
  }
}
