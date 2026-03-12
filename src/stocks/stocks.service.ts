import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Stock } from './entities/stock.entity';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class StocksService {
  constructor(
    @InjectRepository(Stock)
    private stockRepository: Repository<Stock>,
    private readonly httpService: HttpService,
  ) {}

  async create(createStockDto: CreateStockDto) {
    if (!createStockDto.userId) {
      createStockDto.userId = 'default_user';
    }
    const stock = this.stockRepository.create(createStockDto);
    return await this.stockRepository.save(stock);
  }

  async findAll(userId: string = 'default_user') {
    const stocks = await this.stockRepository.find({ where: { userId } });
    
    // Fetch USD-KRW exchange rate from a reliable currency API
    let exchangeRate = 1400; // default backup
    try {
      const exRes = await lastValueFrom(
        this.httpService.get(`https://open.er-api.com/v6/latest/USD`)
      );
      if (exRes.data && exRes.data.rates && exRes.data.rates.KRW) {
        exchangeRate = exRes.data.rates.KRW;
      }
    } catch(e) {
      console.error('Failed to fetch exchange rate, using default 1400', e.message);
    }
    
    // Fetch current prices
    const stocksWithCurrentPrice = await Promise.all(
      stocks.map(async (stock) => {
        let currentPrice = 0;
        let stockName = stock.symbol;
        let currency = 'KRW';
        
        try {
          // A simple public API for demo: yahoo finance
          const response = await lastValueFrom(
            this.httpService.get(`https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}?region=US&lang=en-US`)
          );
          const result = response.data.chart.result;
          if (result && result.length > 0) {
            currentPrice = result[0].meta.regularMarketPrice;
            stockName = result[0].meta.longName || result[0].meta.shortName || stock.symbol;
            currency = result[0].meta.currency || 'KRW';
          }
        } catch (error) {
          console.error(`Failed to fetch price for ${stock.symbol}`);
        }
        
        const returnRate = currentPrice ? ((currentPrice - stock.purchasePrice) / stock.purchasePrice) * 100 : 0;
        
        const mappedResult = {
          ...stock,
          currentPrice,
          stockName,
          currency,
          exchangeRate,
          returnRate: returnRate.toFixed(2) + '%',
        };
        console.log('Mapped Result:', mappedResult);

        return mappedResult;
      })
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
