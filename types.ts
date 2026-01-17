
export interface MilkEntry {
  not?: number;
  extra?: number;
}

export interface MilkData {
  [dateKey: string]: MilkEntry;
}

export interface UserRegistry {
  [deviceId: string]: {
    pwd: string;
    type: string;
    exp: string;
  };
}

export interface AppSettings {
  custPlot: string;
  custAddr: string;
  dailyQty: number;
  rate: number;
  service: number;
  milkman: string;
}
