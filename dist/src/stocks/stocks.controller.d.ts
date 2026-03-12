import { StocksService } from './stocks.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
export declare class StocksController {
    private readonly stocksService;
    constructor(stocksService: StocksService);
    create(createStockDto: CreateStockDto): Promise<import("./entities/stock.entity").Stock>;
    findAll(userId: string): Promise<{
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
    findOne(id: string): Promise<import("./entities/stock.entity").Stock>;
    update(id: string, updateStockDto: UpdateStockDto): Promise<import("./entities/stock.entity").Stock>;
    remove(id: string): Promise<{
        deleted: boolean;
    }>;
}
