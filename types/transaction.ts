export interface Transaction {
  date: string; // YYYY-MM-DD format
  payee: string;
  memo: string;
  outflow: string;
  inflow: string;
}