export class CreateStockDto {
  symbol: string;
  purchasePrice: number;
  quantity?: number;
  userId?: string;
}
