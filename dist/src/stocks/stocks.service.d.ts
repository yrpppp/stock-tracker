import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { Stock } from './entities/stock.entity';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
export declare class StocksService {
    private stockRepository;
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private accessToken;
    private tokenExpiry;
    private readonly kisBaseUrl;
    private readonly kisAppKey;
    private readonly kisAppSecret;
    constructor(stockRepository: Repository<Stock>, httpService: HttpService, configService: ConfigService);
    private getAccessToken;
    private isKoreanStock;
    private normalizeSymbol;
    private fetchKoreanStockPrice;
    private fetchOverseasStockPrice;
    create(createStockDto: CreateStockDto): Promise<Stock>;
    findAll(userId?: string): Promise<{
        currentPrice: number;
        stockName: string;
        currency: string;
        exchangeRate: number;
        returnRate: string;
        id: number;
        symbol: string;
        purchasePrice: number;
        quantity: number;
        userId: string;
        createdAt: Date;
    }[]>;
    findOne(id: number): Promise<Stock>;
    update(id: number, updateStockDto: UpdateStockDto): Promise<Stock>;
    remove(id: number): Promise<{
        deleted: boolean;
    }>;
}
