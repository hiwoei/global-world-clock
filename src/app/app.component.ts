import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface CityData {
  name: string;
  utcOffset: number;
  isReference: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="app-container">
      <div class="header-section">
        <h1>Global World Clock</h1>
        <div class="legend">
          <span class="legend-item"><span class="box ref-box"></span> Reference (Taipei)</span>
          <span class="legend-item"><span class="box normal-box"></span> Other Time Zones</span>
        </div>
      </div>

      <div class="chart-panel">
        <svg width="790" height="530">
          <ng-container *ngFor="let h of [0, 6, 12, 18, 24]">
            <line 
              [attr.x1]="getGridX(h)" y1="0" 
              [attr.x2]="getGridX(h)" [attr.y2]="totalRowsHeight" 
              stroke="#505050" stroke-width="1" />
            <text 
              [attr.x]="getGridX(h) - 5" [attr.y]="totalRowsHeight + 15" 
              fill="#D3D3D3" font-size="12" font-family="Segoe UI">
              {{ h }}
            </text>
          </ng-container>
          
          <line 
            [attr.x1]="labelWidth" [attr.y1]="totalRowsHeight" 
            [attr.x2]="labelWidth + maxBarWidth" [attr.y2]="totalRowsHeight" 
            stroke="#646464" stroke-width="1" />

          <ng-container *ngFor="let city of cities; let i = index">
            <text 
              [attr.x]="labelWidth - 15" [attr.y]="getRectY(i) + 15" 
              fill="white" font-size="13" font-family="Segoe UI" text-anchor="end">
              {{ city.name }}
            </text>

            <rect 
              [attr.x]="labelWidth" [attr.y]="getRectY(i)" 
              [attr.width]="getBarWidth(city)" height="22" 
              [attr.fill]="city.isReference ? '#A0BEFF' : '#323237'">
            </rect>

            <text 
              [attr.x]="labelWidth + getBarWidth(city) + 10" [attr.y]="getRectY(i) + 16" 
              fill="white" font-size="13" font-weight="bold" font-family="Segoe UI">
              {{ getTimeString(city) }}
            </text>
          </ng-container>
        </svg>
      </div>

      <div class="control-section">
        <div class="slider-title">Taipei Time (24h)</div>
        <div class="slider-row">
          <input 
            type="range" 
            min="0" max="1440" step="1" 
            [(ngModel)]="currentTaipeiTotalMinutes" 
            class="time-slider">
          
          <div class="time-display">{{ getTaipeiTimeString() }}</div>
          
          <button class="btn-reset" (click)="resetToNow()">回到目前</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* 全域基礎設定與深色主題 */
    :host {
      display: block;
      min-height: 100vh;
      background-color: #141414;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      color: white;
    }
    
    .app-container {
      width: 880px;
      height: 800px;
      background-color: #141414;
      padding: 20px 30px;
      box-sizing: border-box;
      position: relative;
    }

    .header-section {
      margin-bottom: 30px;
    }

    .header-section h1 {
      margin: 0 0 15px 0;
      font-size: 24px;
    }

    .legend {
      display: flex;
      gap: 20px;
      font-size: 14px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .box {
      width: 12px;
      height: 12px;
      display: inline-block;
    }

    .ref-box { background-color: #A0BEFF; }
    .normal-box { background-color: #50505A; }
    .legend-item:nth-child(2) { color: #A0A0A0; }

    .chart-panel {
      margin-bottom: 20px;
    }

    .control-section {
      position: absolute;
      bottom: 80px;
      left: 30px;
      right: 30px;
    }

    .slider-title {
      font-size: 14px;
      margin-bottom: 10px;
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-left: 130px;
    }

    /* 客製化 HTML5 原生 Range Slider 外觀以還原 WinForms 體驗 */
    .time-slider {
      flex: 1;
      max-width: 500px;
      appearance: none;
      height: 4px;
      background: #3A3A3A;
      outline: none;
      border-radius: 2px;
      cursor: pointer;
    }

    .time-slider::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 24px;
      background: #FFFFFF;
      border-radius: 3px;
      cursor: pointer;
    }

    .time-display {
      background-color: #282828;
      padding: 6px 15px;
      border-radius: 4px;
      font-size: 18px;
      font-weight: bold;
      min-width: 55px;
      text-align: center;
    }

    .btn-reset {
      background-color: #3C3C41;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .btn-reset:hover {
      background-color: #505055;
    }
  `]
})
export class AppComponent implements OnInit {
  cities: CityData[] = [
    { name: "紐西蘭 (Auckland)", utcOffset: 12.0, isReference: false },
    { name: "澳洲 (Sydney)", utcOffset: 10.0, isReference: false },
    { name: "日本/韓國 (Tokyo)", utcOffset: 9.0, isReference: false },
    { name: "台灣 (Taipei)", utcOffset: 8.0, isReference: true },
    { name: "泰國 (Bangkok)", utcOffset: 7.0, isReference: false },
    { name: "印度 (New Delhi)", utcOffset: 5.5, isReference: false },
    { name: "杜拜 (Dubai)", utcOffset: 4.0, isReference: false },
    { name: "德國/法國 (Berlin)", utcOffset: 1.0, isReference: false },
    { name: "英國 (London)", utcOffset: 0.0, isReference: false },
    { name: "巴西 (São Paulo)", utcOffset: -3.0, isReference: false },
    { name: "美國東岸 (New York)", utcOffset: -5.0, isReference: false },
    { name: "美國西岸 (L.A.)", utcOffset: -8.0, isReference: false }
  ];

  // 狀態變數：當下台北的總分鐘數 (0 ~ 1440)
  currentTaipeiTotalMinutes: number = 0;

  // 繪圖常數設定 (還原 WinForms 的座標軸配置)
  readonly labelWidth = 170;
  readonly maxBarWidth = 540; 
  readonly rowHeight = 40;
  readonly startY = 15;

  get totalRowsHeight(): number {
    return this.cities.length * this.rowHeight;
  }

  ngOnInit() {
    this.resetToNow();
  }

  // 重置回當下時間
  resetToNow(): void {
    // 嚴謹實作：利用 UTC 時間加上 8 小時，確保不論使用者的瀏覽器位於何國，都能精準抓到「台北時間」
    const now = new Date();
    const utcTotalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    this.currentTaipeiTotalMinutes = (utcTotalMinutes + 8 * 60) % 1440;
  }

  // 取得 X 軸網格線的座標
  getGridX(hour: number): number {
    return this.labelWidth + ((hour * 60) / 1440.0) * this.maxBarWidth;
  }

  // 取得各城市長條圖的 Y 軸座標
  getRectY(index: number): number {
    return this.startY + (index * this.rowHeight);
  }

  // 核心邏輯：計算目標城市當下的總分鐘數
  getLocalMinutes(city: CityData): number {
    const taipeiOffsetMinutes = 8.0 * 60;
    const cityOffsetMinutes = city.utcOffset * 60;
    
    let localTotalMinutes = this.currentTaipeiTotalMinutes - taipeiOffsetMinutes + cityOffsetMinutes;
    
    // 處理跨日問題：確保數值永遠落在 0 ~ 1439 之間
    localTotalMinutes = ((localTotalMinutes % 1440) + 1440) % 1440;
    return Math.round(localTotalMinutes);
  }

  // 取得長條圖的寬度
  getBarWidth(city: CityData): number {
    return (this.getLocalMinutes(city) / 1440.0) * this.maxBarWidth;
  }

  // 將分鐘數轉換為 HH:mm 格式字串
  getTimeString(city: CityData): string {
    const mins = this.getLocalMinutes(city);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  // 顯示台北基準時間的字串 (處理 1440 顯示為 00:00 的情況)
  getTaipeiTimeString(): string {
    let h = Math.floor(this.currentTaipeiTotalMinutes / 60);
    const m = this.currentTaipeiTotalMinutes % 60;
    if (h === 24) h = 0;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}