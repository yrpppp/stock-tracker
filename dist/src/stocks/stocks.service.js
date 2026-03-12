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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StocksService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const stock_entity_1 = require("./entities/stock.entity");
const typeorm_2 = require("typeorm");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
let StocksService = class StocksService {
    stockRepository;
    httpService;
    constructor(stockRepository, httpService) {
        this.stockRepository = stockRepository;
        this.httpService = httpService;
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
        let exchangeRate = 1400;
        try {
            const exRes = await (0, rxjs_1.lastValueFrom)(this.httpService.get(`https://open.er-api.com/v6/latest/USD`));
            if (exRes.data && exRes.data.rates && exRes.data.rates.KRW) {
                exchangeRate = exRes.data.rates.KRW;
            }
        }
        catch (e) {
            console.error('Failed to fetch exchange rate, using default 1400', e.message);
        }
        const stocksWithCurrentPrice = await Promise.all(stocks.map(async (stock) => {
            let currentPrice = 0;
            let stockName = stock.symbol;
            let currency = 'KRW';
            try {
                const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(`https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}?region=US&lang=en-US`));
                const result = response.data.chart.result;
                if (result && result.length > 0) {
                    currentPrice = result[0].meta.regularMarketPrice;
                    stockName = result[0].meta.longName || result[0].meta.shortName || stock.symbol;
                    currency = result[0].meta.currency || 'KRW';
                }
            }
            catch (error) {
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
exports.StocksService = StocksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(stock_entity_1.Stock)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        axios_1.HttpService])
], StocksService);
//# sourceMappingURL=stocks.service.js.map