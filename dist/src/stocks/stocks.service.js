"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var StocksService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StocksService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const stock_entity_1 = require("./entities/stock.entity");
const typeorm_2 = require("typeorm");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const config_1 = require("@nestjs/config");
let StocksService = StocksService_1 = class StocksService {
    stockRepository;
    httpService;
    configService;
    logger = new common_1.Logger(StocksService_1.name);
    accessToken = null;
    tokenExpiry = null;
    kisBaseUrl;
    kisAppKey;
    kisAppSecret;
    constructor(stockRepository, httpService, configService) {
        this.stockRepository = stockRepository;
        this.httpService = httpService;
        this.configService = configService;
        this.kisBaseUrl = this.configService.get('KIS_BASE_URL', 'https://openapivts.koreainvestment.com:29443');
        this.kisAppKey = this.configService.get('KIS_APP_KEY', '');
        this.kisAppSecret = this.configService.get('KIS_APP_SECRET', '');
    }
    async getAccessToken() {
        if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return this.accessToken;
        }
        this.logger.log('KIS Access Token 발급 요청...');
        try {
            const response = await (0, rxjs_1.lastValueFrom)(this.httpService.post(`${this.kisBaseUrl}/oauth2/tokenP`, {
                grant_type: 'client_credentials',
                appkey: this.kisAppKey,
                appsecret: this.kisAppSecret,
            }));
            this.accessToken = response.data.access_token;
            this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
            this.logger.log('KIS Access Token 발급 성공');
            return this.accessToken;
        }
        catch (error) {
            this.logger.error('KIS Access Token 발급 실패', error.message);
            throw new Error('KIS API 인증 실패. APP_KEY와 APP_SECRET을 확인하세요.');
        }
    }
    isKoreanStock(symbol) {
        const cleaned = symbol.replace(/\.(KS|KQ)$/i, '');
        return /^\d{6}$/.test(cleaned);
    }
    normalizeSymbol(symbol) {
        return symbol.replace(/\.(KS|KQ)$/i, '');
    }
    async fetchKoreanStockPrice(symbol, token) {
        const url = `${this.kisBaseUrl}/uapi/domestic-stock/v1/quotations/inquire-price`;
        const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(url, {
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
        }));
        const output = response.data.output;
        if (!output) {
            throw new Error(`국내 주식 시세 조회 실패: ${symbol}`);
        }
        return {
            currentPrice: parseFloat(output.stck_prpr) || 0,
            stockName: output.rprs_mrkt_kor_name || output.bstp_kor_isnm || symbol,
            currency: 'KRW',
        };
    }
    async fetchOverseasStockPrice(symbol, token) {
        const url = `${this.kisBaseUrl}/uapi/overseas-price/v1/quotations/price`;
        const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(url, {
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
                EXCD: 'NAS',
                SYMB: symbol,
            },
        }));
        const output = response.data.output;
        if (!output) {
            throw new Error(`해외 주식 시세 조회 실패: ${symbol}`);
        }
        return {
            currentPrice: parseFloat(output.last) || 0,
            stockName: output.name || symbol,
            currency: 'USD',
        };
    }
    async create(createStockDto) {
        if (!createStockDto.userId) {
            createStockDto.userId = 'default_user';
        }
        const stock = this.stockRepository.create(createStockDto);
        return await this.stockRepository.save(stock);
    }
    async findAll(userId = 'default_user') {
        const stocks = await this.stockRepository.find({ where: { userId } });
        let token;
        try {
            token = await this.getAccessToken();
        }
        catch (error) {
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
            const exRes = await (0, rxjs_1.lastValueFrom)(this.httpService.get('https://open.er-api.com/v6/latest/USD'));
            if (exRes.data?.rates?.KRW) {
                exchangeRate = exRes.data.rates.KRW;
            }
        }
        catch (e) {
            this.logger.warn('Failed to fetch exchange rate, using default 1400', e.message);
        }
        const stocksWithCurrentPrice = await Promise.all(stocks.map(async (stock) => {
            let currentPrice = 0;
            let stockName = stock.symbol;
            let currency = 'KRW';
            try {
                const normalizedSymbol = this.normalizeSymbol(stock.symbol);
                const isKorean = this.isKoreanStock(stock.symbol);
                if (isKorean) {
                    const result = await this.fetchKoreanStockPrice(normalizedSymbol, token);
                    currentPrice = result.currentPrice;
                    stockName = result.stockName;
                    currency = result.currency;
                }
                else {
                    const result = await this.fetchOverseasStockPrice(normalizedSymbol, token);
                    currentPrice = result.currentPrice;
                    stockName = result.stockName;
                    currency = result.currency;
                }
            }
            catch (error) {
                this.logger.error(`Failed to fetch price for ${stock.symbol}: ${error.message}`);
            }
            const returnRate = currentPrice
                ? ((currentPrice - stock.purchasePrice) / stock.purchasePrice) * 100
                : 0;
            const mappedResult = {
                ...stock,
                currentPrice,
                stockName,
                currency,
                exchangeRate,
                returnRate: returnRate.toFixed(2) + '%',
            };
            this.logger.debug(`Mapped Result: ${JSON.stringify(mappedResult)}`);
            return mappedResult;
        }));
        return stocksWithCurrentPrice;
    }
    async findOne(id) {
        const stock = await this.stockRepository.findOneBy({ id });
        if (!stock)
            throw new common_1.NotFoundException('Stock not found');
        return stock;
    }
    async update(id, updateStockDto) {
        await this.stockRepository.update(id, updateStockDto);
        return this.findOne(id);
    }
    async remove(id) {
        await this.stockRepository.delete(id);
        return { deleted: true };
    }
};
exports.StocksService = StocksService;
exports.StocksService = StocksService = StocksService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(stock_entity_1.Stock)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        axios_1.HttpService,
        config_1.ConfigService])
], StocksService);
//# sourceMappingURL=stocks.service.js.map