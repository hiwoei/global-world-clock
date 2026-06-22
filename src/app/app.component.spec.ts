import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
/*
純前端的 JavaScript 是無法「憑空猜測」一個未知地名的座標（用來算距離）與時區的。如果在字典檔找不到，我們卻要強行算出正確的距離與 UTC 時差，唯一嚴謹且絕對不允許猜測的做法，就是串接外部的地理資訊 API (Geocoding API)。

為了解決這個問題，我為您整合了德國開源免費的 Open-Meteo Geocoding API。它的優點是免註冊、免 API Key 且支援繁體中文搜尋。

核心運作邏輯升級：
防抖機制 (Debounce)：您在搜尋框打字時，程式會先在本地字典檔搜尋。如果找不到，程式會耐心等您「停止打字 0.8 秒後」，才發送網路請求，避免過度消耗網路資源。

即時抓取與計算：API 會回傳該地名的經緯度與 IANA 時區名稱（如 Europe/Paris）。

半正矢公式 (Haversine Formula)：程式收到經緯度後，會以台北的經緯度 (25.0330, 121.5654) 為基準，即時運用球面三角學公式算出直線公里數。

動態時差解析：利用 JavaScript 原生的 Intl.DateTimeFormat 解譯 IANA 時區，動態換算出正確的 UTC 加減時數。

*/


// 資料結構：加入 distanceKm 來記錄與台灣的直線距離 (單位：公里)
interface CityData {
  name: string;
  utcOffset: number;
  isReference: boolean;
  searchKeys: string; 
  distanceKm: number; 
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="page-shell">
      <section class="hero-section">
        <div class="hero-content">
          <div class="eyebrow">Taiwan Time Zone Reference</div>
          <h1>台灣時區對照</h1>
          <p>
            以台灣台北 UTC+8 為基準，快速比較全球主要城市的即時時間、時差與距離，
            並支援中英文搜尋與未知城市動態定位。
          </p>
        </div>

        <div class="taipei-card">
          <div class="card-label">Taipei Local Time</div>
          <div class="card-time">{{ getTaipeiTimeString() }}</div>
          <div class="card-meta">UTC+08:00｜台灣基準日期時間</div>
        </div>
      </section>

      <section class="quick-stats" aria-label="功能摘要">
        <article class="stat-card">
          <span class="stat-icon">🌐</span>
          <div>
            <strong>全球城市對照</strong>
            <p>預設涵蓋亞洲、歐洲、美洲、非洲與大洋洲代表城市。</p>
          </div>
        </article>

        <article class="stat-card">
          <span class="stat-icon">🎛️</span>
          <div>
            <strong>24 小時模擬</strong>
            <p>以分鐘為單位拖曳台灣時間，立即換算各地當地時間。</p>
          </div>
        </article>

        <article class="stat-card">
          <span class="stat-icon">📡</span>
          <div>
            <strong>動態定位</strong>
            <p>本地找不到時，保留原本 Open-Meteo API 查詢與錯誤處理。</p>
          </div>
        </article>
      </section>

      <section class="workspace-card">
        <div class="toolbar-section">
          <div class="section-heading">
            <h2>全球時間比較</h2>
            <p>輸入國家、城市、中文或英文關鍵字，即可篩選時區資料。</p>
          </div>

          <div class="legend" aria-label="圖例">
            <span class="legend-item"><span class="box ref-box"></span> 台灣基準</span>
            <span class="legend-item"><span class="box normal-box"></span> 其他時區</span>
          </div>
        </div>

        <div class="search-section">
          <input
            type="text"
            [(ngModel)]="searchText"
            (ngModelChange)="onSearchChange()"
            placeholder="搜尋國家或城市，例如：雪梨、巴黎、Seattle、冰島"
            class="search-input"
            aria-label="搜尋國家或城市">
        </div>

        <div class="hover-info-container">
          <div class="hover-info" [class.visible]="activeCity !== null">
            <ng-container *ngIf="activeCity">
              <span class="highlight-name">{{ activeCity.name }}</span>
              <span class="local-time-text">當地 {{ getTimeString(activeCity) }}</span>
              <span class="diff-text">{{ getDifferenceText(activeCity) }}</span>
              <span class="dist-text" *ngIf="activeCity.distanceKm > 0">
                距台灣約 {{ activeCity.distanceKm | number }} 公里
              </span>
              <span class="dist-text" *ngIf="activeCity.distanceKm === -1">距離未知</span>
            </ng-container>
            <span *ngIf="!activeCity" class="placeholder-text">桌機可將滑鼠移至 bar；手機可點選城市列 / bar，查看時差、當地時間與距離</span>
          </div>
        </div>

        <div class="chart-panel">
          <div class="chart-scroll">
            <svg
              class="time-chart"
              [attr.viewBox]="'0 0 ' + chartWidth + ' ' + (totalRowsHeight + 40)"
              [attr.height]="totalRowsHeight + 40"
              role="img"
              aria-label="全球城市時間長條圖">

              <ng-container *ngFor="let h of [0, 6, 12, 18, 24]">
                <line
                  [attr.x1]="getGridX(h)" y1="0"
                  [attr.x2]="getGridX(h)" [attr.y2]="totalRowsHeight"
                  stroke="#334155" stroke-width="1" />
                <text
                  [attr.x]="getGridX(h) - 5" [attr.y]="totalRowsHeight + 20"
                  fill="#94A3B8" font-size="12" font-family="Segoe UI">
                  {{ h }}
                </text>
              </ng-container>

              <line
                [attr.x1]="labelWidth" [attr.y1]="totalRowsHeight"
                [attr.x2]="labelWidth + maxBarWidth" [attr.y2]="totalRowsHeight"
                stroke="#475569" stroke-width="1" />

              <g *ngFor="let city of displayedCities; let i = index"
                 class="city-row"
                 [class.active]="isActiveCity(city)"
                 tabindex="0"
                 role="button"
                 [attr.aria-label]="getBarDescription(city)"
                 (mouseenter)="hoveredCity = city"
                 (mouseleave)="hoveredCity = null"
                 (focus)="focusedCity = city"
                 (blur)="focusedCity = null"
                 (click)="selectCity(city)"
                 (keydown.enter)="selectCity(city)"
                 (keydown.space)="$event.preventDefault(); selectCity(city)">

                <title>{{ getBarDescription(city) }}</title>

                <rect
                  [attr.x]="0" [attr.y]="getRectY(i) - 10"
                  [attr.width]="chartWidth" [attr.height]="rowHeight"
                  fill="transparent" class="hover-bg">
                </rect>

                <text
                  [attr.x]="labelWidth - 15" [attr.y]="getRectY(i) + 15"
                  [attr.fill]="isActiveCity(city) ? '#FFFFFF' : '#CBD5E1'"
                  font-size="13" font-family="Segoe UI" text-anchor="end"
                  class="city-text">
                  {{ city.name }}
                </text>

                <rect
                  [attr.x]="labelWidth" [attr.y]="getRectY(i)"
                  [attr.width]="getBarWidth(city)" height="22"
                  rx="5" ry="5"
                  [attr.fill]="city.isReference ? '#7DD3FC' : (isActiveCity(city) ? '#64748B' : '#1E293B')"
                  style="transition: fill 0.2s;">
                </rect>

                <text
                  [attr.x]="labelWidth + getBarWidth(city) + 10" [attr.y]="getRectY(i) + 16"
                  [attr.fill]="isActiveCity(city) ? '#FFFFFF' : '#E2E8F0'"
                  font-size="13" font-weight="700" font-family="Segoe UI">
                  {{ getTimeString(city) }}
                </text>

                <g *ngIf="isActiveCity(city)" class="bar-note">
                  <rect
                    [attr.x]="getTooltipX(city)"
                    [attr.y]="getTooltipY(i)"
                    width="285"
                    height="30"
                    rx="10"
                    ry="10">
                  </rect>
                  <text
                    [attr.x]="getTooltipX(city) + 12"
                    [attr.y]="getTooltipY(i) + 20"
                    font-size="12"
                    font-weight="700"
                    font-family="Segoe UI">
                    {{ getBarShortDescription(city) }}
                  </text>
                </g>
              </g>
            </svg>
          </div>
        </div>

        <div class="control-section">
          <div class="slider-title">台灣時間模擬（24 小時制）</div>
          <div class="slider-row">
            <input
              type="range"
              min="0" max="1440" step="1"
              [(ngModel)]="currentTaipeiTotalMinutes"
              (input)="pauseLiveClock()"
              class="time-slider"
              aria-label="台灣時間滑桿">

            <div class="time-display">{{ getTaipeiTimeString() }}</div>
            <div class="live-status" [class.paused]="!isLiveClock">
              {{ isLiveClock ? '即時更新中' : '手動模擬中' }}
            </div>
            <button class="btn-reset" type="button" (click)="resetToNow()">回到目前時間</button>
          </div>
        </div>
      </section>

      <section class="feature-description">
        <h3>功能完整說明</h3>
        <ul>
          <li><strong>全球時區與大圓距離：</strong>預設面板網羅全球各洲代表性城市。滑鼠移至城市上方，或手機點選城市列時，會顯示該城市與台灣的時差，並標示兩地之間的球面直線距離。</li>
          <li><strong>24 小時動態時間模擬：</strong>透過分鐘級動態滑桿任意拖曳時間，圖表長條圖與右側時間會即時依照台灣時間重新換算。</li>
          <li><strong>中英雙語智慧模糊搜尋：</strong>可輸入繁體中文或英文名稱，例如「美」、「澳洲」、「Manila」、「Dhaka」。</li>
          <li><strong>全球網路動態定位：</strong>若輸入城市不在預設清單中，系統會透過既有防抖機制呼叫 Open-Meteo Geocoding API，解析經緯度與 IANA 時區後再動態顯示。</li>
        </ul>
      </section>
    </main>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(125, 211, 252, 0.18), transparent 32rem),
        linear-gradient(135deg, #020617 0%, #0F172A 48%, #111827 100%);
      font-family: 'Segoe UI', 'Noto Sans TC', Tahoma, Geneva, Verdana, sans-serif;
      color: #F8FAFC;
    }

    .page-shell {
      width: min(1120px, calc(100% - 40px));
      margin: 0 auto;
      padding: 40px 0;
      box-sizing: border-box;
    }

    .hero-section {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 24px;
      align-items: stretch;
      margin-bottom: 22px;
    }

    .hero-content,
    .taipei-card,
    .workspace-card,
    .feature-description,
    .stat-card {
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(15, 23, 42, 0.82);
      box-shadow: 0 24px 60px rgba(2, 6, 23, 0.35);
      backdrop-filter: blur(12px);
    }

    .hero-content {
      border-radius: 24px;
      padding: 34px 36px;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      margin-bottom: 14px;
      border-radius: 999px;
      background: rgba(125, 211, 252, 0.13);
      color: #BAE6FD;
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .hero-content h1 {
      margin: 0;
      font-size: clamp(32px, 5vw, 54px);
      line-height: 1.05;
      letter-spacing: -0.04em;
    }

    .hero-content p {
      margin: 18px 0 0 0;
      max-width: 720px;
      color: #CBD5E1;
      font-size: 16px;
      line-height: 1.75;
    }

    .taipei-card {
      border-radius: 24px;
      padding: 28px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background:
        linear-gradient(160deg, rgba(14, 165, 233, 0.24), rgba(15, 23, 42, 0.86)),
        rgba(15, 23, 42, 0.82);
    }

    .card-label {
      color: #BAE6FD;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .card-time {
      margin-top: 12px;
      font-size: 30px;
      line-height: 1.15;
      font-weight: 800;
      letter-spacing: -0.03em;
      white-space: nowrap;
    }

    .card-meta {
      margin-top: 12px;
      color: #CBD5E1;
      font-size: 14px;
    }

    .quick-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 22px;
    }

    .stat-card {
      display: flex;
      gap: 14px;
      border-radius: 18px;
      padding: 18px;
    }

    .stat-icon {
      flex: 0 0 auto;
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: rgba(125, 211, 252, 0.12);
      font-size: 20px;
    }

    .stat-card strong {
      display: block;
      margin-bottom: 6px;
      color: #FFFFFF;
      font-size: 15px;
    }

    .stat-card p {
      margin: 0;
      color: #94A3B8;
      font-size: 13px;
      line-height: 1.55;
    }

    .workspace-card {
      border-radius: 24px;
      padding: 24px;
      margin-bottom: 22px;
    }

    .toolbar-section {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .section-heading h2 {
      margin: 0;
      font-size: 24px;
      letter-spacing: -0.02em;
    }

    .section-heading p {
      margin: 8px 0 0 0;
      color: #94A3B8;
      font-size: 14px;
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
      font-size: 13px;
      color: #CBD5E1;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.18);
      white-space: nowrap;
    }

    .box {
      width: 12px;
      height: 12px;
      border-radius: 4px;
      display: inline-block;
    }

    .ref-box { background-color: #7DD3FC; }
    .normal-box { background-color: #64748B; }

    .search-section { margin-bottom: 16px; }

    .search-input {
      width: 100%;
      padding: 14px 16px;
      font-size: 15px;
      border-radius: 14px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      background: rgba(2, 6, 23, 0.54);
      color: #FFFFFF;
      outline: none;
      font-family: inherit;
      transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;
    }

    .search-input:focus {
      border-color: #7DD3FC;
      background-color: rgba(15, 23, 42, 0.9);
      box-shadow: 0 0 0 4px rgba(125, 211, 252, 0.12);
    }

    .search-input::placeholder { color: #64748B; }

    .hover-info-container {
      min-height: 42px;
      margin-bottom: 16px;
    }

    .hover-info {
      width: 100%;
      box-sizing: border-box;
      background: rgba(2, 6, 23, 0.45);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-left: 4px solid transparent;
      border-radius: 14px;
      padding: 10px 14px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      transition: all 0.2s ease;
    }

    .hover-info.visible {
      border-left-color: #7DD3FC;
      background-color: rgba(15, 23, 42, 0.92);
    }

    .highlight-name {
      color: #FFFFFF;
      font-weight: 800;
    }

    .diff-text,
    .local-time-text {
      color: #7DD3FC;
      font-weight: 700;
    }

    .dist-text {
      color: #FACC15;
      font-weight: 700;
    }

    .placeholder-text {
      color: #94A3B8;
      font-size: 13px;
    }

    .chart-panel {
      margin-bottom: 20px;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      background: rgba(2, 6, 23, 0.30);
      overflow: hidden;
    }

    .chart-scroll {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      padding: 18px;
      box-sizing: border-box;
    }

    .time-chart {
      display: block;
      width: 100%;
      min-width: 1040px;
    }

    .city-row {
      cursor: pointer;
      outline: none;
    }

    .city-row:hover .hover-bg,
    .city-row:focus .hover-bg,
    .city-row.active .hover-bg {
      fill: rgba(125, 211, 252, 0.08);
    }

    .city-text { transition: fill 0.2s; }

    .bar-note rect {
      fill: rgba(15, 23, 42, 0.96);
      stroke: rgba(125, 211, 252, 0.72);
      stroke-width: 1;
      filter: drop-shadow(0 10px 18px rgba(2, 6, 23, 0.42));
    }

    .bar-note text {
      fill: #F8FAFC;
      pointer-events: none;
    }

    .control-section {
      border-top: 1px solid rgba(148, 163, 184, 0.16);
      padding-top: 18px;
    }

    .slider-title {
      font-size: 14px;
      margin-bottom: 12px;
      color: #CBD5E1;
      font-weight: 700;
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .time-slider {
      flex: 1;
      min-width: 120px;
      appearance: none;
      height: 6px;
      background: #334155;
      outline: none;
      border-radius: 999px;
      cursor: pointer;
    }

    .time-slider::-webkit-slider-thumb {
      appearance: none;
      width: 18px;
      height: 28px;
      background: #FFFFFF;
      border: 3px solid #7DD3FC;
      border-radius: 7px;
      cursor: pointer;
      box-shadow: 0 8px 18px rgba(2, 6, 23, 0.35);
    }

    .time-slider::-moz-range-thumb {
      width: 18px;
      height: 28px;
      background: #FFFFFF;
      border: 3px solid #7DD3FC;
      border-radius: 7px;
      cursor: pointer;
      box-shadow: 0 8px 18px rgba(2, 6, 23, 0.35);
    }

    .time-display {
      background: rgba(2, 6, 23, 0.68);
      padding: 8px 16px;
      border-radius: 12px;
      font-size: 19px;
      font-weight: 800;
      min-width: 76px;
      text-align: center;
      border: 1px solid rgba(148, 163, 184, 0.24);
    }

    .btn-reset {
      background: linear-gradient(135deg, #0284C7, #0EA5E9);
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.2s, filter 0.2s;
      white-space: nowrap;
    }

    .btn-reset:hover {
      filter: brightness(1.08);
      transform: translateY(-1px);
    }

    .feature-description {
      border-radius: 24px;
      padding: 24px 28px;
      color: #CBD5E1;
      line-height: 1.75;
    }

    .feature-description h3 {
      margin: 0 0 12px 0;
      color: #FFFFFF;
      font-size: 20px;
    }

    .feature-description ul {
      margin: 0;
      padding-left: 20px;
    }

    .feature-description li + li {
      margin-top: 8px;
    }

    @media (max-width: 900px) {
      .page-shell {
        width: min(100% - 28px, 760px);
        padding: 24px 0;
      }

      .hero-section {
        grid-template-columns: 1fr;
      }

      .quick-stats {
        grid-template-columns: 1fr;
      }

      .toolbar-section {
        flex-direction: column;
      }

      .legend {
        justify-content: flex-start;
      }

      .taipei-card {
        padding: 22px;
      }

      .card-time {
        font-size: 30px;
      }
    }

    @media (max-width: 600px) {
      .page-shell {
        width: 100%;
        padding: 0;
      }

      .hero-content,
      .taipei-card,
      .workspace-card,
      .feature-description {
        border-radius: 0;
        border-left: 0;
        border-right: 0;
      }

      .hero-section {
        gap: 0;
        margin-bottom: 14px;
      }

      .hero-content {
        padding: 28px 18px;
      }

      .hero-content p {
        font-size: 15px;
      }

      .taipei-card {
        padding: 22px 18px;
      }

      .quick-stats {
        gap: 10px;
        margin: 0 14px 14px;
      }

      .stat-card {
        padding: 15px;
      }

      .workspace-card {
        padding: 18px 14px;
      }

      .section-heading h2 {
        font-size: 21px;
      }

      .legend {
        width: 100%;
      }

      .legend-item {
        flex: 1 1 auto;
        justify-content: center;
      }

      .hover-info {
        align-items: flex-start;
        flex-direction: column;
        gap: 4px;
      }

      .chart-scroll {
        padding: 12px;
      }

      .time-chart {
        min-width: 1040px;
      }

      .slider-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
      }

      .time-slider {
        grid-column: 1 / -1;
        width: 100%;
      }

      .time-display {
        min-width: 84px;
      }

      .btn-reset {
        width: 100%;
      }

      .feature-description {
        padding: 22px 18px 30px;
      }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  searchText: string = '';
  currentTaipeiTotalMinutes: number = 0;
  hoveredCity: CityData | null = null;
  focusedCity: CityData | null = null;
  selectedCity: CityData | null = null;
  private searchTimeout: ReturnType<typeof setTimeout> | null = null; // 用於防抖機制的計時器
  private clockTimer: ReturnType<typeof setInterval> | null = null; // 用於台灣目前時間自動更新
  isLiveClock: boolean = true; // true：跟隨目前時間；false：使用者正在手動模擬時間
  private taipeiDateStartUtcMs: number = 0; // 目前選定的台灣日期 00:00 對應 UTC timestamp

  // 繪圖設定常數
  readonly chartWidth = 1040;
  readonly labelWidth = 220; 
  readonly maxBarWidth = 560; 
  readonly rowHeight = 35; 
  readonly startY = 15;
  readonly tooltipWidth = 430;

  // 台北經緯度基準點 (用於計算直線距離)
  private readonly taipeiLat = 25.0330;
  private readonly taipeiLon = 121.5654;

  // 全球大辭典：維持本地快取，減少 API 呼叫次數
  private readonly masterCities: CityData[] = [
    { name: "台灣 (Taipei)", utcOffset: 8.0, isReference: true, searchKeys: "taiwan taipei 台灣 台北 roc", distanceKm: 0 },
    { name: "日本 東京 (Tokyo)", utcOffset: 9.0, isReference: false, searchKeys: "japan tokyo 日本 東京", distanceKm: 2100 },
    { name: "韓國 首爾 (Seoul)", utcOffset: 9.0, isReference: false, searchKeys: "korea seoul 韓國 首爾", distanceKm: 1480 },
    { name: "中國 北京 (Beijing)", utcOffset: 8.0, isReference: false, searchKeys: "china beijing 中國 北京 大陸", distanceKm: 1710 },
    { name: "菲律賓 馬尼拉 (Manila)", utcOffset: 8.0, isReference: false, searchKeys: "philippines manila 菲律賓 馬尼拉", distanceKm: 1170 },
    { name: "泰國 曼谷 (Bangkok)", utcOffset: 7.0, isReference: false, searchKeys: "thailand bangkok 泰國 曼谷", distanceKm: 2530 },
    { name: "越南 河內 (Hanoi)", utcOffset: 7.0, isReference: false, searchKeys: "vietnam hanoi 越南 河內", distanceKm: 1650 },
    { name: "孟加拉 達卡 (Dhaka)", utcOffset: 6.0, isReference: false, searchKeys: "bangladesh dhaka 孟加拉 達卡", distanceKm: 3740 }, 
    { name: "印度 新德里 (New Delhi)", utcOffset: 5.5, isReference: false, searchKeys: "india new delhi 印度 新德里", distanceKm: 4380 },
    { name: "杜拜 (Dubai)", utcOffset: 4.0, isReference: false, searchKeys: "dubai uae 杜拜 阿拉伯", distanceKm: 6550 },
    { name: "俄羅斯 莫斯科 (Moscow)", utcOffset: 3.0, isReference: false, searchKeys: "russia moscow 俄羅斯 莫斯科", distanceKm: 7340 },
    { name: "埃及 開羅 (Cairo)", utcOffset: 2.0, isReference: false, searchKeys: "egypt cairo 埃及 開羅", distanceKm: 8730 },
    { name: "南非 (Johannesburg)", utcOffset: 2.0, isReference: false, searchKeys: "south africa johannesburg 南非 約翰尼斯堡", distanceKm: 11730 },
    { name: "德國 柏林 (Berlin)", utcOffset: 1.0, isReference: false, searchKeys: "germany berlin 德國 柏林 歐洲", distanceKm: 8990 },
    { name: "法國 巴黎 (Paris)", utcOffset: 1.0, isReference: false, searchKeys: "france paris 法國 巴黎 歐洲", distanceKm: 9840 },
    { name: "英國 倫敦 (London)", utcOffset: 0.0, isReference: false, searchKeys: "uk england london 英國 倫敦", distanceKm: 9780 },
    { name: "巴西 聖保羅 (São Paulo)", utcOffset: -3.0, isReference: false, searchKeys: "brazil sao paulo 巴西 聖保羅", distanceKm: 18790 },
    { name: "美國 紐約 (New York)", utcOffset: -5.0, isReference: false, searchKeys: "usa america united states new york 美國 東岸 紐約", distanceKm: 12530 },
    { name: "美國 芝加哥 (Chicago)", utcOffset: -6.0, isReference: false, searchKeys: "usa america united states chicago 美國 中部 芝加哥", distanceKm: 11970 },
    { name: "美國 洛杉磯 (L.A.)", utcOffset: -8.0, isReference: false, searchKeys: "usa america united states los angeles california 美國 西岸 洛杉磯 加州", distanceKm: 10920 },
    { name: "美國 夏威夷 (Hawaii)", utcOffset: -10.0, isReference: false, searchKeys: "usa america united states hawaii 美國 夏威夷", distanceKm: 8140 },
    { name: "澳大利亞 雪梨 (Sydney)", utcOffset: 10.0, isReference: false, searchKeys: "australia sydney 澳洲 澳大利亞 雪梨 悉尼", distanceKm: 7270 }, 
    { name: "澳大利亞 伯斯 (Perth)", utcOffset: 8.0, isReference: false, searchKeys: "australia perth 澳洲 澳大利亞 伯斯", distanceKm: 6070 },
    { name: "紐西蘭 奧克蘭 (Auckland)", utcOffset: 12.0, isReference: false, searchKeys: "new zealand auckland 紐西蘭 奧克蘭", distanceKm: 8870 }
  ];

  private readonly defaultCities: CityData[] = [
    this.masterCities.find(c => c.name.includes("紐西蘭"))!,
    this.masterCities.find(c => c.name.includes("澳大利亞 雪梨"))!,
    this.masterCities.find(c => c.name.includes("日本"))!,
    this.masterCities.find(c => c.name.includes("台灣"))!,
    this.masterCities.find(c => c.name.includes("菲律賓"))!,
    this.masterCities.find(c => c.name.includes("泰國"))!,
    this.masterCities.find(c => c.name.includes("孟加拉 達卡"))!,
    this.masterCities.find(c => c.name.includes("印度"))!,
    this.masterCities.find(c => c.name.includes("杜拜"))!,
    this.masterCities.find(c => c.name.includes("法國"))!,
    this.masterCities.find(c => c.name.includes("英國"))!,
    this.masterCities.find(c => c.name.includes("巴西"))!,
    this.masterCities.find(c => c.name.includes("美國 紐約"))!,
    this.masterCities.find(c => c.name.includes("美國 洛杉磯"))!
  ];

  displayedCities: CityData[] = [];

  get totalRowsHeight(): number {
    return this.displayedCities.length * this.rowHeight;
  }

  get activeCity(): CityData | null {
    return this.hoveredCity ?? this.focusedCity ?? this.selectedCity;
  }

  ngOnInit() {
    this.displayedCities = [...this.defaultCities];
    this.resetToNow();
    this.startLiveClock();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  private startLiveClock(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }

    this.clockTimer = setInterval(() => {
      if (this.isLiveClock) {
        this.syncTaipeiTimeToNow();
      }
    }, 1000);
  }

  pauseLiveClock(): void {
    this.isLiveClock = false;
  }

  private syncTaipeiTimeToNow(): void {
    const taipeiNow = this.getTaipeiNowParts();
    this.currentTaipeiTotalMinutes = taipeiNow.hour * 60 + taipeiNow.minute;
    this.taipeiDateStartUtcMs = this.getTaipeiDateStartUtcMs(
      taipeiNow.year,
      taipeiNow.month,
      taipeiNow.day
    );
  }

  private getTaipeiNowParts(): { year: number; month: number; day: number; hour: number; minute: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(new Date());
    const getPart = (type: string): number => Number(parts.find(p => p.type === type)?.value ?? 0);

    let hour = getPart('hour');
    if (hour === 24) {
      hour = 0;
    }

    return {
      year: getPart('year'),
      month: getPart('month'),
      day: getPart('day'),
      hour,
      minute: getPart('minute')
    };
  }

  private getTaipeiDateStartUtcMs(year: number, month: number, day: number): number {
    return Date.UTC(year, month - 1, day, 0, 0, 0) - (8 * 60 * 60 * 1000);
  }

  // ==== 搜尋功能核心邏輯 (加入 API 即時查詢防呆機制) ====
  onSearchChange() {
    this.selectedCity = null;
    this.hoveredCity = null;
    this.focusedCity = null;

    const keyword = this.searchText.trim().toLowerCase();
    
    // 清除前一次的計時器 (防抖機制)
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // 1. 如果清空搜尋框，立即恢復預設列表
    if (!keyword) {
      this.displayedCities = [...this.defaultCities];
      return;
    }

    // 2. 先在本地字典中進行 LIKE 模糊比對
    const results = this.masterCities.filter(city => 
      city.searchKeys.toLowerCase().includes(keyword) || 
      city.name.toLowerCase().includes(keyword)
    );

    if (results.length > 0) {
      this.displayedCities = results;
    } else {
      // 3. 本地找不到，先秀出「搜尋中」畫面
      this.displayedCities = [{
        name: `📡 正在全球網路定位 "${this.searchText}" ...`,
        utcOffset: 0.0,
        isReference: false,
        searchKeys: '',
        distanceKm: -1 
      }];

      // 設定 0.8 秒延遲，確定使用者打完字後，才呼叫外部 API
      this.searchTimeout = setTimeout(() => {
        this.fetchDynamicCityData(this.searchText.trim());
      }, 800);
    }
  }

  // ==== 呼叫外部 API 獲取未知城市的座標與時區 ====
  async fetchDynamicCityData(keyword: string) {
    try {
      // 使用 Open-Meteo 免費的地理編碼 API
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(keyword)}&count=1&language=zh`);
      const data = await response.json();

      if (data && data.results && data.results.length > 0) {
        const result = data.results[0];
        const lat = result.latitude;
        const lon = result.longitude;
        const tzName = result.timezone; // 格式如 "Europe/Paris"
        const country = result.country ? `, ${result.country}` : '';

        // 計算距離與動態解析 UTC Offset
        const distance = this.calculateDistanceToTaipei(lat, lon);
        const offset = this.parseUtcOffsetFromTimezone(tzName);

        this.displayedCities = [{
          name: `${result.name}${country} (即時抓取)`,
          utcOffset: offset,
          isReference: false,
          searchKeys: '',
          distanceKm: distance
        }];
      } else {
        // API 也找不到這個地名
        this.displayedCities = [{
          name: `找不到 "${keyword}" 的經緯度與時區資料`,
          utcOffset: 0.0,
          isReference: false,
          searchKeys: '',
          distanceKm: -1 
        }];
      }
    } catch (error) {
      console.error('API Fetch Error:', error);
      this.displayedCities = [{
        name: `連線 API 失敗，無法動態獲取資料`,
        utcOffset: 0.0,
        isReference: false,
        searchKeys: '',
        distanceKm: -1 
      }];
    }
  }

  // 半正矢公式 (Haversine Formula) 計算地球兩點直線距離
  calculateDistanceToTaipei(lat: number, lon: number): number {
    const R = 6371; // 地球半徑公里
    const dLat = (lat - this.taipeiLat) * Math.PI / 180;
    const dLon = (lon - this.taipeiLon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.taipeiLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
  }

  // 利用瀏覽器原生的 Intl 引擎，解析 IANA 時區字串獲得精確的 UTC Offset 數值
  parseUtcOffsetFromTimezone(timeZoneName: string): number {
    try {
      const date = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZoneName,
        timeZoneName: 'longOffset'
      });
      const parts = formatter.formatToParts(date);
      const tzPart = parts.find(p => p.type === 'timeZoneName');

      if (tzPart && tzPart.value) {
        // 值通常會是 "GMT+08:00" 或 "GMT"
        let offsetStr = tzPart.value.replace('GMT', '');
        if (!offsetStr) return 0; 
        
        const sign = offsetStr.startsWith('-') ? -1 : 1;
        const timeParts = offsetStr.replace(/[+-]/, '').split(':');
        const h = parseInt(timeParts[0], 10);
        const m = timeParts.length > 1 ? parseInt(timeParts[1], 10) : 0;
        
        return (h + (m / 60)) * sign;
      }
    } catch (e) {
      console.error("Timezone parsing failed for:", timeZoneName);
    }
    return 0; // 備用方案
  }


  selectCity(city: CityData): void {
    this.selectedCity = this.selectedCity === city ? null : city;
  }

  isActiveCity(city: CityData): boolean {
    return this.activeCity === city;
  }

  getTooltipX(city: CityData): number {
    const preferredX = this.labelWidth + this.getBarWidth(city) + 12;
    return Math.max(this.labelWidth, Math.min(preferredX, this.chartWidth - this.tooltipWidth - 8));
  }

  getTooltipY(index: number): number {
    const y = this.getRectY(index) - 6;
    return Math.max(2, y);
  }

  getBarDescription(city: CityData): string {
    const distanceText = city.distanceKm > 0
      ? `距台灣約 ${city.distanceKm.toLocaleString('zh-TW')} 公里`
      : city.distanceKm === 0
        ? '台灣基準城市'
        : '距離未知';

    return `${city.name}，當地時間 ${this.getTimeString(city)}，${this.getDifferenceText(city)}，${distanceText}`;
  }

  getBarShortDescription(city: CityData): string {
    const distanceText = city.distanceKm > 0
      ? `距約 ${city.distanceKm.toLocaleString('zh-TW')} 公里`
      : city.distanceKm === 0
        ? '台灣基準'
        : '距離未知';

    return `${this.getTimeString(city)}｜${this.getDifferenceText(city)}｜${distanceText}`;
  }

  resetToNow(): void {
    this.isLiveClock = true;
    this.syncTaipeiTimeToNow();
  }

  getGridX(hour: number): number {
    return this.labelWidth + ((hour * 60) / 1440.0) * this.maxBarWidth;
  }

  getRectY(index: number): number {
    return this.startY + (index * this.rowHeight);
  }

  getLocalMinutes(city: CityData): number {
    const taipeiOffsetMinutes = 8.0 * 60;
    const cityOffsetMinutes = city.utcOffset * 60;
    let localTotalMinutes = this.currentTaipeiTotalMinutes - taipeiOffsetMinutes + cityOffsetMinutes;
    localTotalMinutes = ((localTotalMinutes % 1440) + 1440) % 1440;
    return Math.round(localTotalMinutes);
  }

  getBarWidth(city: CityData): number {
    return (this.getLocalMinutes(city) / 1440.0) * this.maxBarWidth;
  }

  getTimeString(city: CityData): string {
    return this.getLocalDateTimeString(city.utcOffset);
  }

  getTaipeiTimeString(): string {
    return this.getLocalDateTimeString(8.0);
  }

  private getLocalDateTimeString(utcOffset: number): string {
    const taipeiDateStartUtcMs = this.taipeiDateStartUtcMs || this.getFallbackTaipeiDateStartUtcMs();
    const selectedTaipeiInstantUtcMs = taipeiDateStartUtcMs + (this.currentTaipeiTotalMinutes * 60 * 1000);
    const localDisplayMs = selectedTaipeiInstantUtcMs + (utcOffset * 60 * 60 * 1000);
    const localDate = new Date(localDisplayMs);

    const yyyy = localDate.getUTCFullYear();
    const mm = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getUTCDate()).padStart(2, '0');
    const hh = String(localDate.getUTCHours()).padStart(2, '0');
    const mi = String(localDate.getUTCMinutes()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  private getFallbackTaipeiDateStartUtcMs(): number {
    const taipeiNow = this.getTaipeiNowParts();
    return this.getTaipeiDateStartUtcMs(taipeiNow.year, taipeiNow.month, taipeiNow.day);
  }

  getDifferenceText(city: CityData): string {
    if (city.isReference) return '基準時間 (與台灣無時差)';
    if (city.distanceKm === -1) return '請嘗試輸入其他城市或使用英文名稱';
    
    const diff = 8.0 - city.utcOffset; 
    if (diff > 0) {
      return `比台灣慢 ${diff} 小時`;
    } else if (diff < 0) {
      return `比台灣快 ${Math.abs(diff)} 小時`;
    } else {
      return `與台灣無時差`;
    }
  }
}