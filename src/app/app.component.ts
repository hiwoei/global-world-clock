import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface CityData {
  name: string;
  utcOffset: number;
  isReference: boolean;
  searchKeys: string;
  distanceKm: number;
}

interface EventLocation {
  country: string;
  city: string;
  place: string;
  flag: string;
  lat: number;
  lon: number;
  timeZone: string;
  startDayOffset: number;
  startTime: string;
  searchKeys: string;
}

interface ScheduleRow extends EventLocation {
  startAbsMinutes: number;
}

type ActiveTab = 'cooldown' | 'schedule' | 'official' | 'clock';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="page-shell">
      <section class="hero-section">
        <div class="hero-content">
          <div class="eyebrow">Global Event Time Zone Planner</div>
          <h1>玩家全球活動時區對照工具</h1>
          <p>
            以台灣時間為基準，整合全球活動地點、GPS 點位、年月日時對照與冷卻銜接建議。
            手機可直接切換分頁查詢，桌機可使用表格與時間軸快速比較。
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
          <span class="stat-icon">🕒</span>
          <div>
            <strong>時間對照</strong>
            <p>以台灣年月日時為基準，快速對應各活動地點的當地日期時間。</p>
          </div>
        </article>

        <article class="stat-card">
          <span class="stat-icon">🧭</span>
          <div>
            <strong>冷卻銜接</strong>
            <p>輸入目前活動時段與冷卻時間，立即找出下一個可銜接國家。</p>
          </div>
        </article>

        <article class="stat-card">
          <span class="stat-icon">📍</span>
          <div>
            <strong>活動地點 GPS 清單</strong>
            <p>依固定全球活動地點建立清單，包含國家、地點與座標。</p>
          </div>
        </article>

        <article class="stat-card">
          <span class="stat-icon">🌐</span>
          <div>
            <strong>活動時間換算</strong>
            <p>官方公告某地當地時間時，可直接換算成台灣日期時間。</p>
          </div>
        </article>
      </section>

      <section class="tab-card">
        <nav class="tab-nav" aria-label="主要功能分頁">
          <button type="button" class="tab-button" [class.active]="activeTab === 'clock'" (click)="setActiveTab('clock')">
            時間對照
          </button>
          <button type="button" class="tab-button" [class.active]="activeTab === 'cooldown'" (click)="setActiveTab('cooldown')">
            冷卻銜接
          </button>
          <button type="button" class="tab-button" [class.active]="activeTab === 'schedule'" (click)="setActiveTab('schedule')">
            活動時段/區域分類
          </button>
          <button type="button" class="tab-button" [class.active]="activeTab === 'official'" (click)="setActiveTab('official')">
            活動時間換算
          </button>
        </nav>

        <section class="tab-panel" *ngIf="activeTab === 'cooldown'">
          <div class="panel-heading">
            <div>
              <h2>冷卻銜接建議</h2>
              <p>輸入你目前參與活動的台灣時間，系統會列出該時段國家，並依冷卻結束時間推薦下一個最合適銜接地點。</p>
            </div>
            <span class="hint-pill">預設：當日 14:00 活動，當日 18:00 起算冷卻；可銜接時間由「冷卻開始日期時間 + 冷卻時間」即時計算。</span>
          </div>

          <div class="planner-grid">
            <label class="form-field">
              <span>目前活動開始日期時間</span>
              <div class="datetime-pair">
                <input type="date" [(ngModel)]="plannerStartDate" (ngModelChange)="onPlannerChanged()">
                <input
                  type="text"
                  class="time-input"
                  inputmode="numeric"
                  maxlength="5"
                  placeholder="14:00"
                  [(ngModel)]="plannerStartTime"
                  (ngModelChange)="onPlannerChanged()"
                  (blur)="normalizePlannerTimes()">
              </div>
            </label>

            <label class="form-field">
              <span>冷卻開始日期時間</span>
              <div class="datetime-pair">
                <input type="date" [(ngModel)]="plannerCooldownStartDate" (ngModelChange)="onPlannerChanged()">
                <input
                  type="text"
                  class="time-input"
                  inputmode="numeric"
                  maxlength="5"
                  placeholder="18:00"
                  [(ngModel)]="plannerCooldownStartTime"
                  (ngModelChange)="onPlannerChanged()"
                  (blur)="normalizePlannerTimes()">
              </div>
            </label>

            <label class="form-field">
              <span>冷卻時間（小時）</span>
              <input type="number" min="0" max="12" step="0.5" [(ngModel)]="plannerCooldownHours" (ngModelChange)="onPlannerChanged()">
            </label>

            <div class="planner-summary">
              <span>可銜接時間</span>
              <strong>{{ getFormattedPlannerReadyDateTime() }}</strong>
              <small>冷卻開始日期時間 + 冷卻時間</small>
            </div>
          </div>

          <div class="result-grid">
            <article class="result-card">
              <h3>{{ getFormattedPlannerStartDateTime() }} 對應活動地點</h3>
              <p class="result-note">列出活動開始日期時間等於你輸入值的國家 / 地點。</p>

              <div class="mini-list" *ngIf="getLocationsAtPlannerStart().length > 0; else noPlannerStart">
                <div class="mini-row" *ngFor="let item of getLocationsAtPlannerStart()">
                  <div class="flag">{{ item.flag }}</div>
                  <div>
                    <strong>{{ item.country }} {{ item.city }}</strong>
                    <span>{{ item.place }}｜{{ item.lat.toFixed(5) }},{{ item.lon.toFixed(5) }}</span>
                  </div>
                </div>
              </div>

              <ng-template #noPlannerStart>
                <div class="empty-state">沒有找到 {{ getFormattedPlannerStartDateTime() }} 開始的活動地點。</div>
              </ng-template>
            </article>

            <article class="result-card emphasis">
              <h3>最佳銜接建議</h3>
              <ng-container *ngIf="getBestRecommendation() as best; else noBest">
                <div class="best-time">{{ formatAbsMinutes(getScheduleStartAbsMinutes(best)) }}</div>
                <div class="best-place">{{ best.flag }} {{ best.country }} {{ best.city }}</div>
                <div class="best-sub">{{ best.place }}</div>
                <div class="gps-line">GPS：{{ best.lat.toFixed(5) }},{{ best.lon.toFixed(5) }}</div>
                <p class="result-note">
                  原因：此地點活動開始時間最接近且不早於可銜接時間 {{ getFormattedPlannerReadyDateTime() }}。
                </p>
              </ng-container>

              <ng-template #noBest>
                <div class="empty-state">冷卻結束後，清單內沒有更晚可銜接的活動。</div>
              </ng-template>
            </article>
          </div>

          <div class="mobile-table-card">
            <h3>冷卻後可銜接清單</h3>
            <div class="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>推薦</th>
                    <th>台灣時間</th>
                    <th>國家 / 地點</th>
                    <th>GPS</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of getPlannerRows()">
                    <td>
                      <span class="status-badge" [class.best]="isBestRecommendation(row)">
                        {{ isBestRecommendation(row) ? '最佳' : '可接' }}
                      </span>
                    </td>
                    <td>{{ formatAbsMinutes(getScheduleStartAbsMinutes(row)) }}</td>
                    <td>
                      <strong>{{ row.flag }} {{ row.country }} {{ row.city }}</strong>
                      <small>{{ row.place }}</small>
                    </td>
                    <td>{{ row.lat.toFixed(5) }},{{ row.lon.toFixed(5) }}</td>
                    <td>{{ getRecommendationReason(row) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="tab-panel" *ngIf="activeTab === 'schedule'">
          <div class="panel-heading">
            <div>
              <h2>全球活動時段 / 區域分類</h2>
              <p>活動開始會先列出「台灣」目前活動開始日期時間，後續地點再依全球活動時間順序往後推算，並保留 GPS 點位與半球分類。</p>
            </div>
             
          </div>

          <div class="schedule-toolbar">
            <input type="text" [(ngModel)]="eventSearchText" placeholder="搜尋國家、城市、地點或 GPS" class="search-input">
            <button type="button" class="btn-reset compact" (click)="eventSearchText = ''">清除</button>
          </div>

          <div class="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>活動開始（台灣時間）</th>
                  <th>地點</th>
                  <th>GPS</th>
                  <th>半球</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of getFilteredScheduleRows()">
                  <td class="time-cell">{{ formatAbsMinutes(getScheduleStartAbsMinutes(row)) }}</td>
                  <td>
                    <strong>{{ row.flag }} {{ row.country }} {{ row.city }}</strong>
                    <small>{{ row.place }}</small>
                  </td>
                  <td>
                    <button
                      type="button"
                      class="gps-button"
                      [class.copied]="isGpsCopied(row)"
                      [attr.aria-label]="isGpsCopied(row) ? 'GPS 已複製' : '複製 GPS'"
                      (click)="copyGps(row)">
                      <span class="gps-value">{{ getGpsText(row) }}</span>
                      <span class="copy-label">{{ isGpsCopied(row) ? '已複製' : '複製' }}</span>
                    </button>
                  </td>
                  <td>
                    <span class="hemi-tag">{{ getNorthSouth(row) }}</span>
                    <span class="hemi-tag">{{ getEastWest(row) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>


          <div class="region-note-section">
            <div class="panel-heading compact-heading">
              <div>
                <h2>限定區域說明</h2>
                <p>依 GPS 自動分類東 / 西半球與南 / 北半球；只顯示本次活動地點分布，不顯示會隨活動變動的限定內容清單。</p>
              </div>
            </div>

          <div class="hemisphere-grid">
            <article class="hemisphere-card">
              <h3>北半球地點</h3>
              <div class="location-chip" *ngFor="let row of getNorthLocations()">
                  {{ row.flag }} {{ row.country }} {{ row.city }}｜{{ row.place }}

              </div>
            </article>

            <article class="hemisphere-card">
              <h3>南半球地點</h3>
              <div class="location-chip" *ngFor="let row of getSouthLocations()">
                  {{ row.flag }} {{ row.country }} {{ row.city }}｜{{ row.place }}

              </div>
            </article>

            <article class="hemisphere-card">
              <h3>東半球地點</h3>
              <div class="location-chip" *ngFor="let row of getEastLocations()">
                  {{ row.flag }} {{ row.country }} {{ row.city }}｜{{ row.place }}

              </div>
            </article>

            <article class="hemisphere-card">
              <h3>西半球地點</h3>
              <div class="location-chip" *ngFor="let row of getWestLocations()">
                  {{ row.flag }} {{ row.country }} {{ row.city }}｜{{ row.place }}

              </div>
            </article>
          </div>

          <p class="rule-note">
            判斷規則：緯度 ≥ 0 為北半球，緯度 < 0 為南半球；經度 ≥ 0 為東半球，經度 < 0 為西半球。
          </p>
          </div>
        </section>

        <section class="tab-panel" *ngIf="activeTab === 'official'">
          <div class="panel-heading">
            <div>
              <h2>當地活動時間換算</h2>
              <p>適用於官方公告已指定「某地當地時間」的活動。選擇活動地點並輸入官方公告的當地日期時間，系統會換算成台灣時間。</p>
            </div>
            <span class="hint-pill">此功能不同於「活動時段/區域分類」的全球接力時段表；這裡是單一地點的官方當地時間換算。</span>
          </div>

          <div class="official-grid">
            <label class="form-field">
              <span>官方活動地點</span>
              <select [(ngModel)]="officialLocationIndex">
                <option *ngFor="let row of officialLocations; let i = index" [ngValue]="i">
                  {{ row.flag }} {{ row.country }} {{ row.city }}｜{{ row.place }}
                </option>
              </select>
            </label>

            <label class="form-field">
              <span>官方當地日期</span>
              <input type="date" [(ngModel)]="officialLocalDate">
            </label>

            <label class="form-field">
              <span>官方當地時間</span>
              <input
                type="text"
                class="time-input"
                inputmode="numeric"
                maxlength="5"
                placeholder="10:00"
                [(ngModel)]="officialLocalTime"
                (blur)="normalizeOfficialTime()">
            </label>

            <div class="planner-summary">
              <span>換算後台灣時間</span>
              <strong>{{ getOfficialTaiwanDateTime() }}</strong>
              <small>{{ getOfficialOffsetText() }}</small>
            </div>
          </div>

          <div class="result-grid official-result-grid">
            <article class="result-card">
              <h3>活動當地時間</h3>
              <ng-container *ngIf="getOfficialSelectedLocation() as officialLocation">
                <div class="mini-row">
                  <div class="flag">{{ officialLocation.flag }}</div>
                  <div>
                    <strong>{{ officialLocation.country }} {{ officialLocation.city }}</strong>
                    <span>{{ officialLocation.place }}｜{{ officialLocation.timeZone }}</span>
                    <span>當地時間：{{ getFormattedOfficialLocalDateTime() }}</span>
                    <span>GPS：{{ officialLocation.lat.toFixed(5) }},{{ officialLocation.lon.toFixed(5) }}</span>
                  </div>
                </div>
              </ng-container>
            </article>

            <article class="result-card emphasis">
              <h3>台灣時間換算結果</h3>
              <div class="best-time">{{ getOfficialTaiwanDateTime() }}</div>
              <p class="result-note">
                例如官方寫「巴西聖保羅當地 2026/6/23 10:00」，本功能會依聖保羅時區換算成台灣時間。
              </p>
              <p class="result-note">
                注意：若官方活動不是依全球接力時段，而是指定某地當地時間，請使用本分頁，不要用「活動時段/區域分類」判斷。
              </p>
            </article>
          </div>
        </section>

        <section class="tab-panel" *ngIf="activeTab === 'clock'">
          <div class="toolbar-section">
            <div class="section-heading">
              <h2>台灣時間對照</h2>
              <p>預設顯示活動地點清單，也可搜尋一般國家、城市、中文或英文關鍵字。</p>
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
              placeholder="搜尋國家或城市，例如：台北、東京、西班牙、Seattle、冰島"
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
                      [attr.width]="tooltipWidth"
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
      </section>

      <section class="feature-description">
        <h3>功能完整說明</h3>
        <ul>
          <li><strong>時間對照：</strong>保留原本 RWD、手機點選 bar、桌機 hover、搜尋、Open-Meteo 動態查詢、距離與 API 錯誤處理，並以年月日時顯示各地當地時間。</li>
          <li><strong>冷卻銜接：</strong>依台灣活動時間與冷卻時間推算下一個可參與國家，預設使用當日「14:00 活動、18:00 起算冷卻、2 小時後銜接」。</li>
          <li><strong>活動時段/區域分類：</strong>採用固定全球活動地點清單，活動開始會先列出台灣目前活動開始日期時間，後續地點依全球活動時間順序往後推算，並在同一分頁依 GPS 自動判斷東西半球與南北半球；只列地點分布，不寫死會隨活動變動的限定內容清單。</li>
          <li><strong>活動時間換算：</strong>當公告指定某地當地日期時間時，可選擇地點並輸入該地當地時間，系統會換算成台灣時間，避免和全球活動接力時段混用。</li>
        </ul>
        <p class="disclaimer-note">
          本工具為非官方玩家自用時間與地點對照工具；不使用官方圖像、Logo 或角色素材，亦不表示與任何遊戲公司或品牌有合作、授權或認可關係。
        </p>
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
      width: min(1180px, calc(100% - 40px));
      margin: 0 auto;
      padding: 40px 0;
      box-sizing: border-box;
    }

    .hero-section {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 330px;
      gap: 24px;
      align-items: stretch;
      margin-bottom: 22px;
    }

    .hero-content,
    .taipei-card,
    .tab-card,
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
      font-size: clamp(31px, 5vw, 52px);
      line-height: 1.05;
      letter-spacing: -0.04em;
    }

    .hero-content p {
      margin: 18px 0 0 0;
      max-width: 760px;
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
      grid-template-columns: repeat(4, minmax(0, 1fr));
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

    .tab-card {
      border-radius: 24px;
      margin-bottom: 22px;
      overflow: hidden;
    }

    .tab-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      padding: 14px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      background: rgba(2, 6, 23, 0.28);
    }

    .tab-button {
      flex: 0 0 auto;
      appearance: none;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 999px;
      background: rgba(2, 6, 23, 0.45);
      color: #CBD5E1;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 800;
      white-space: nowrap;
      cursor: pointer;
      min-height: 42px;
      transition: background 0.2s, color 0.2s, border-color 0.2s;
    }

    .tab-button.active {
      color: #082F49;
      background: #7DD3FC;
      border-color: #7DD3FC;
    }

    .tab-panel {
      padding: 24px;
    }

    .panel-heading,
    .toolbar-section {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .panel-heading h2,
    .section-heading h2 {
      margin: 0;
      font-size: 24px;
      letter-spacing: -0.02em;
    }

    .panel-heading p,
    .section-heading p {
      margin: 8px 0 0 0;
      color: #94A3B8;
      font-size: 14px;
      line-height: 1.6;
    }

    .hint-pill {
      flex: 0 0 auto;
      max-width: 360px;
      padding: 9px 12px;
      border-radius: 14px;
      background: rgba(125, 211, 252, 0.12);
      border: 1px solid rgba(125, 211, 252, 0.24);
      color: #BAE6FD;
      font-size: 13px;
      line-height: 1.55;
    }

    .planner-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }

    .official-grid {
      display: grid;
      grid-template-columns: minmax(260px, 1.5fr) minmax(160px, 0.85fr) minmax(120px, 0.65fr) minmax(260px, 1fr);
      gap: 14px;
      margin-bottom: 18px;
    }

    .official-result-grid {
      margin-top: 4px;
    }

    .form-field {
      display: grid;
      gap: 8px;
      color: #CBD5E1;
      font-size: 13px;
      font-weight: 800;
    }

    .datetime-pair {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(88px, 0.75fr);
      gap: 8px;
    }

    .field-hint {
      color: #94A3B8;
      font-size: 12px;
      line-height: 1.45;
      font-weight: 700;
    }

    .planner-summary small {
      color: #94A3B8;
      font-size: 12px;
      line-height: 1.45;
      font-weight: 700;
    }

    .form-field input,
    .form-field select,
    .search-input {
      width: 100%;
      padding: 13px 14px;
      font-size: 15px;
      border-radius: 14px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      background: rgba(2, 6, 23, 0.54);
      color: #FFFFFF;
      outline: none;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
    }

    .form-field select {
      min-width: 0;
      text-overflow: ellipsis;
    }

    .form-field select option {
      background: #0F172A;
      color: #FFFFFF;
    }

    .form-field input:focus,
    .form-field select:focus,
    .search-input:focus {
      border-color: #7DD3FC;
      background-color: rgba(15, 23, 42, 0.9);
      box-shadow: 0 0 0 4px rgba(125, 211, 252, 0.12);
    }

    .planner-summary {
      border-radius: 16px;
      border: 1px solid rgba(125, 211, 252, 0.24);
      background: rgba(125, 211, 252, 0.10);
      padding: 14px;
      display: grid;
      align-content: center;
      gap: 7px;
    }

    .planner-summary span {
      color: #BAE6FD;
      font-size: 13px;
      font-weight: 800;
    }

    .planner-summary strong {
      font-size: 21px;
      color: #FFFFFF;
    }

    .result-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 16px;
      margin-bottom: 18px;
    }

    .result-card,
    .mobile-table-card,
    .exclusive-card,
    .hemisphere-card {
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: rgba(2, 6, 23, 0.32);
      border-radius: 18px;
      padding: 18px;
    }

    .result-card.emphasis {
      background: linear-gradient(160deg, rgba(14, 165, 233, 0.20), rgba(2, 6, 23, 0.38));
      border-color: rgba(125, 211, 252, 0.34);
    }

    .result-card h3,
    .mobile-table-card h3,
    .exclusive-card h3,
    .hemisphere-card h3 {
      margin: 0 0 10px;
      font-size: 18px;
      color: #FFFFFF;
    }

    .result-note {
      margin: 8px 0 0;
      color: #94A3B8;
      line-height: 1.65;
      font-size: 13px;
    }

    .mini-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }

    .mini-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 11px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.58);
    }

    .mini-row .flag {
      font-size: 22px;
      line-height: 1;
    }

    .mini-row strong,
    .mini-row span {
      display: block;
    }

    .mini-row span,
    small {
      color: #94A3B8;
      margin-top: 4px;
      font-size: 12px;
      line-height: 1.45;
    }

    .best-time {
      font-size: 32px;
      font-weight: 900;
      color: #7DD3FC;
      line-height: 1.22;
      overflow-wrap: anywhere;
    }

    .best-place {
      margin-top: 8px;
      font-size: 20px;
      font-weight: 900;
    }

    .best-sub,
    .gps-line {
      margin-top: 6px;
      color: #CBD5E1;
    }

    .empty-state {
      padding: 16px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.58);
      color: #CBD5E1;
    }

    .schedule-toolbar {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }

    .responsive-table {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 16px;
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    table {
      width: 100%;
      min-width: 900px;
      border-collapse: collapse;
      background: rgba(2, 6, 23, 0.22);
    }

    th,
    td {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.13);
      text-align: left;
      vertical-align: top;
      font-size: 14px;
    }

    th {
      color: #BAE6FD;
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: rgba(15, 23, 42, 0.74);
      white-space: nowrap;
    }

    td strong,
    td small {
      display: block;
    }

    .time-cell {
      font-weight: 900;
      color: #F8FAFC;
      white-space: nowrap;
    }

    .gps-button {
      border: 0;
      border-radius: 999px;
      padding: 7px 10px;
      background: rgba(125, 211, 252, 0.12);
      color: #BAE6FD;
      cursor: pointer;
      white-space: nowrap;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background-color 0.2s, color 0.2s, transform 0.2s;
    }

    .gps-button:hover,
    .gps-button:focus {
      background: rgba(125, 211, 252, 0.22);
      outline: none;
      transform: translateY(-1px);
    }

    .gps-button.copied {
      background: rgba(34, 197, 94, 0.18);
      color: #BBF7D0;
    }

    .gps-value {
      font-variant-numeric: tabular-nums;
    }

    .copy-label {
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.10);
      font-size: 11px;
      line-height: 1.4;
    }

    .status-badge,
    .hemi-tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 5px 9px;
      background: rgba(148, 163, 184, 0.15);
      color: #CBD5E1;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }

    .status-badge.best {
      background: rgba(250, 204, 21, 0.18);
      color: #FDE68A;
    }

    .hemi-tag + .hemi-tag {
      margin-left: 6px;
    }

    .exclusive-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .exclusive-item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 11px 0;
      border-top: 1px solid rgba(148, 163, 184, 0.15);
    }

    .exclusive-item strong {
      color: #BAE6FD;
    }

    .hemisphere-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .location-chip {
      display: inline-flex;
      margin: 5px 5px 0 0;
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.68);
      color: #CBD5E1;
      font-size: 13px;
    }

    .rule-note {
      margin: 16px 0 0;
      color: #94A3B8;
      font-size: 13px;
      line-height: 1.6;
    }

    .region-note-section {
      margin-top: 22px;
      padding-top: 22px;
      border-top: 1px solid rgba(148, 163, 184, 0.16);
    }

    .compact-heading {
      margin-bottom: 14px;
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

    .live-status {
      color: #BAE6FD;
      font-size: 13px;
      font-weight: 800;
      white-space: nowrap;
    }

    .live-status.paused {
      color: #FDE68A;
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

    .btn-reset.compact {
      padding: 9px 14px;
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

    .disclaimer-note {
      margin: 16px 0 0;
      padding-top: 14px;
      border-top: 1px solid rgba(148, 163, 184, 0.16);
      color: #94A3B8;
      font-size: 13px;
      line-height: 1.7;
    }

    @media (max-width: 1100px) {
      .quick-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .official-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 900px) {
      .page-shell {
        width: min(100% - 28px, 760px);
        padding: 24px 0;
      }

      .hero-section {
        grid-template-columns: 1fr;
      }

      .quick-stats,
      .planner-grid,
      .official-grid,
      .result-grid,
      .exclusive-grid,
      .hemisphere-grid {
        grid-template-columns: 1fr;
      }

      .panel-heading,
      .toolbar-section {
        flex-direction: column;
      }

      .hint-pill {
        max-width: none;
        width: 100%;
        box-sizing: border-box;
      }

      .legend {
        justify-content: flex-start;
      }

      .taipei-card {
        padding: 22px;
      }
    }

    @media (max-width: 600px) {
      .page-shell {
        width: 100%;
        padding: 0;
      }

      .hero-content,
      .taipei-card,
      .tab-card,
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

      .card-time {
        font-size: 24px;
        white-space: normal;
      }

      .quick-stats {
        gap: 10px;
        margin: 0 14px 14px;
        grid-template-columns: 1fr;
      }

      .stat-card {
        padding: 15px;
      }

      .tab-nav {
        position: sticky;
        top: 0;
        z-index: 5;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        padding: 10px 12px;
        overflow-x: visible;
      }

      .tab-button {
        width: 100%;
        min-width: 0;
        padding: 10px 8px;
        font-size: 13px;
      }

      .tab-panel {
        padding: 18px 14px;
      }

      .panel-heading h2,
      .section-heading h2 {
        font-size: 21px;
      }

      .planner-grid,
      .official-grid {
        gap: 12px;
      }

      .datetime-pair {
        grid-template-columns: 1fr;
      }

      .planner-summary strong {
        font-size: 18px;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }

      .best-time {
        font-size: 24px;
      }

      .schedule-toolbar {
        display: grid;
        grid-template-columns: 1fr;
      }

      .responsive-table {
        border-radius: 14px;
      }

      table {
        min-width: 840px;
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

    @media (max-width: 380px) {
      .tab-nav {
        grid-template-columns: 1fr;
      }

      .hero-content {
        padding: 24px 16px;
      }

      .tab-panel {
        padding: 16px 12px;
      }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  activeTab: ActiveTab = 'clock';

  searchText: string = '';
  eventSearchText: string = '';

  plannerStartDate: string = '';
  plannerStartTime: string = '14:00';
  plannerCooldownStartDate: string = '';
  plannerCooldownStartTime: string = '18:00';
  plannerCooldownHours: number = 2;

  officialLocationIndex: number = 0;
  officialLocalDate: string = '';
  officialLocalTime: string = '10:00';

  currentTaipeiTotalMinutes: number = 0;
  hoveredCity: CityData | null = null;
  focusedCity: CityData | null = null;
  selectedCity: CityData | null = null;
  copiedGpsText: string | null = null;
  private copiedGpsTimer: ReturnType<typeof setTimeout> | null = null;
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  isLiveClock: boolean = true;
  private taipeiDateStartUtcMs: number = 0;

  readonly chartWidth = 1040;
  readonly labelWidth = 220;
  readonly maxBarWidth = 560;
  readonly rowHeight = 35;
  readonly startY = 15;
  readonly tooltipWidth = 430;

  private readonly taipeiLat = 25.0330;
  private readonly taipeiLon = 121.5654;

  private readonly eventLocations: EventLocation[] = [
    { flag: '🇰🇮', country: '吉里巴斯', city: '聖誕島', place: '倫敦', lat: 1.9869, lon: -157.4771, timeZone: 'Pacific/Kiritimati', startDayOffset: 0, startTime: '08:00', searchKeys: 'kiribati christmas island london 吉里巴斯 聖誕島 倫敦' },
    { flag: '🇼🇸', country: '薩摩亞', city: '阿皮亞', place: '市政府廣場', lat: -13.8305, lon: -171.7667, timeZone: 'Pacific/Apia', startDayOffset: 0, startTime: '09:00', searchKeys: 'samoa apia city hall 薩摩亞 阿皮亞 市政府廣場' },
    { flag: '🇳🇿', country: '紐西蘭', city: '威靈頓', place: '植物園', lat: -41.2844, lon: 174.7676, timeZone: 'Pacific/Auckland', startDayOffset: 0, startTime: '10:00', searchKeys: 'new zealand wellington botanic garden 紐西蘭 威靈頓 植物園' },
    { flag: '🇳🇨', country: '法屬新喀里多尼亞', city: '努美阿', place: '滑板公園', lat: -22.2134, lon: 166.4664, timeZone: 'Pacific/Noumea', startDayOffset: 0, startTime: '11:00', searchKeys: 'new caledonia noumea skate park 法屬新喀里多尼亞 努美阿 滑板公園' },
    { flag: '🇦🇺', country: '澳洲', city: '雪梨', place: '皇家植物園', lat: -33.8647, lon: 151.2167, timeZone: 'Australia/Sydney', startDayOffset: 0, startTime: '12:00', searchKeys: 'australia sydney royal botanic garden 澳洲 雪梨 皇家植物園' },
    { flag: '🇦🇺', country: '澳洲', city: '阿德萊德', place: '慶典中心', lat: -34.9191, lon: 138.5988, timeZone: 'Australia/Adelaide', startDayOffset: 0, startTime: '12:30', searchKeys: 'australia adelaide festival centre 澳洲 阿德萊德 慶典中心' },
    { flag: '🇯🇵', country: '日本', city: '東京', place: '上野恩賜公園', lat: 35.7140, lon: 139.7717, timeZone: 'Asia/Tokyo', startDayOffset: 0, startTime: '13:00', searchKeys: 'japan tokyo ueno park 日本 東京 上野恩賜公園' },
    { flag: '🇯🇵', country: '日本', city: '東京', place: '池袋西口公園', lat: 35.7297, lon: 139.7099, timeZone: 'Asia/Tokyo', startDayOffset: 0, startTime: '13:00', searchKeys: 'japan tokyo ueno park 日本 東京 池袋西口公園' },
    { flag: '🇹🇼', country: '台灣', city: '台北', place: '大安森林公園', lat: 25.0307, lon: 121.5352, timeZone: 'Asia/Taipei', startDayOffset: 0, startTime: '14:00', searchKeys: 'taiwan taipei daan forest park 台灣 台北 大安森林公園' },
    { flag: '🇹🇼', country: '台灣', city: '台北', place: '台北車站', lat: 25.0478, lon: 121.5170, timeZone: 'Asia/Taipei', startDayOffset: 0, startTime: '14:00', searchKeys: 'taiwan taipei main station taipei station 台灣 台北 台北車站 北車' },
    { flag: '🇻🇳', country: '越南', city: '胡志明市', place: '陶丹公園', lat: 10.7741, lon: 106.6927, timeZone: 'Asia/Ho_Chi_Minh', startDayOffset: 0, startTime: '15:00', searchKeys: 'vietnam ho chi minh tao dan park 越南 胡志明市 陶丹公園' },
    { flag: '🇧🇩', country: '孟加拉', city: '達卡', place: '達卡兒童公園', lat: 23.7348, lon: 90.3976, timeZone: 'Asia/Dhaka', startDayOffset: 0, startTime: '16:00', searchKeys: 'bangladesh dhaka children park 孟加拉 達卡 兒童公園' },
    { flag: '🇮🇳', country: '印度', city: '新德里', place: '洛迪花園', lat: 28.5929, lon: 77.2206, timeZone: 'Asia/Kolkata', startDayOffset: 0, startTime: '16:30', searchKeys: 'india new delhi lodhi garden 印度 新德里 洛迪花園' },
    { flag: '🇲🇻', country: '馬爾地夫', city: '馬律', place: '市中心', lat: 4.1725, lon: 73.5089, timeZone: 'Indian/Maldives', startDayOffset: 0, startTime: '17:00', searchKeys: 'maldives male city center 馬爾地夫 馬律 市中心' },
    { flag: '🇦🇪', country: '阿拉伯聯合大公國', city: '迪拜', place: '碼頭', lat: 25.0766, lon: 55.1328, timeZone: 'Asia/Dubai', startDayOffset: 0, startTime: '18:00', searchKeys: 'uae dubai marina 阿拉伯聯合大公國 迪拜 碼頭' },
    { flag: '🇬🇷', country: '希臘', city: '拉里薩', place: '卡扎里公園', lat: 39.6418, lon: 22.4133, timeZone: 'Europe/Athens', startDayOffset: 0, startTime: '19:00', searchKeys: 'greece larissa park 希臘 拉里薩 卡扎里公園' },
    { flag: '🇪🇸', country: '西班牙', city: '扎拉戈沙', place: '化學公園', lat: 41.6619, lon: -0.8935, timeZone: 'Europe/Madrid', startDayOffset: 0, startTime: '20:00', searchKeys: 'spain zaragoza chemistry park 西班牙 扎拉戈沙 化學公園' },
    { flag: '🇬🇧', country: '英國', city: '倫敦', place: '國會廣場', lat: 51.5007, lon: -0.1258, timeZone: 'Europe/London', startDayOffset: 0, startTime: '21:00', searchKeys: 'uk london parliament square 英國 倫敦 國會廣場' },
    { flag: '🇮🇸', country: '冰島', city: '雷克雅維克', place: '音樂廳公園', lat: 64.1412, lon: -21.9440, timeZone: 'Atlantic/Reykjavik', startDayOffset: 0, startTime: '22:00', searchKeys: 'iceland reykjavik harpa park 冰島 雷克雅維克 音樂廳公園' },
    { flag: '🇨🇻', country: '維德角', city: '普拉亞', place: '民族博物館', lat: 14.9213, lon: -23.5070, timeZone: 'Atlantic/Cape_Verde', startDayOffset: 0, startTime: '23:00', searchKeys: 'cape verde praia museum 維德角 普拉亞 民族博物館' },
    { flag: '🇧🇷', country: '巴西', city: '聖米格爾', place: '宮殿', lat: -3.8406, lon: -32.4108, timeZone: 'America/Noronha', startDayOffset: 1, startTime: '00:00', searchKeys: 'brazil sao miguel palace 巴西 聖米格爾 宮殿' },
    { flag: '🇧🇷', country: '巴西', city: '聖保羅', place: '伊比拉布埃拉公園', lat: -23.5880 , lon:  -46.6551, timeZone: 'America/Sao_Paulo', startDayOffset: 1, startTime: '01:00', searchKeys: 'brazil sao paulo ibirapuera park 巴西 聖保羅 伊比拉布埃拉公園' },
    { flag: '🇺🇸', country: '美國', city: '紐約', place: '中央公園', lat: 40.7796, lon: -73.9644, timeZone: 'America/New_York', startDayOffset: 1, startTime: '02:00', searchKeys: 'usa new york central park 美國 紐約 中央公園' },
    { flag: '🇵🇪', country: '秘魯', city: '利馬', place: '錢凱廣場', lat: -11.5629, lon: -77.2701, timeZone: 'America/Lima', startDayOffset: 1, startTime: '03:00', searchKeys: 'peru lima plaza 秘魯 利馬 錢凱廣場' },
    { flag: '🇲🇽', country: '墨西哥', city: '墨西哥城', place: '城市公園', lat: 19.4192, lon: -99.1808, timeZone: 'America/Mexico_City', startDayOffset: 1, startTime: '04:00', searchKeys: 'mexico mexico city park 墨西哥 墨西哥城 城市公園' },
    { flag: '🇺🇸', country: '美國', city: '舊金山', place: '漁人碼頭', lat: 37.8093, lon: -122.4157, timeZone: 'America/Los_Angeles', startDayOffset: 1, startTime: '05:00', searchKeys: 'usa san francisco fisherman wharf 美國 舊金山 漁人碼頭' },
    { flag: '🇺🇸', country: '美國', city: '史華德', place: '阿拉斯加海洋中心', lat: 60.0999, lon: -149.4408, timeZone: 'America/Anchorage', startDayOffset: 1, startTime: '06:00', searchKeys: 'usa seward alaska sea life center 美國 史華德 阿拉斯加海洋中心' },
    { flag: '🇵🇫', country: '法屬玻里尼西亞', city: '甘比爾群島', place: '甘比爾群島', lat: -23.1232, lon: -134.9685, timeZone: 'Pacific/Gambier', startDayOffset: 1, startTime: '07:00', searchKeys: 'french polynesia gambier islands 法屬玻里尼西亞 甘比爾群島' },
    { flag: '🇺🇸', country: '美國', city: '夏威夷', place: '檀香山動物園', lat: 21.2715, lon: -157.8226, timeZone: 'Pacific/Honolulu', startDayOffset: 1, startTime: '08:00', searchKeys: 'usa hawaii honolulu zoo 美國 夏威夷 檀香山動物園' },
    { flag: '🇦🇸', country: '美屬薩摩亞', city: '巴哥巴哥', place: '博物館', lat: -14.2777, lon: -170.6877, timeZone: 'Pacific/Pago_Pago', startDayOffset: 1, startTime: '09:00', searchKeys: 'american samoa pago pago museum 美屬薩摩亞 巴哥巴哥 博物館' }
  ];

  private readonly generalCities: CityData[] = [
    { name: '台灣 (Taipei)', utcOffset: 8.0, isReference: true, searchKeys: 'taiwan taipei 台灣 台北 roc', distanceKm: 0 },
    { name: '日本 東京 (Tokyo)', utcOffset: 9.0, isReference: false, searchKeys: 'japan tokyo 日本 東京', distanceKm: 2100 },
    { name: '韓國 首爾 (Seoul)', utcOffset: 9.0, isReference: false, searchKeys: 'korea seoul 韓國 首爾', distanceKm: 1480 },
    { name: '中國 北京 (Beijing)', utcOffset: 8.0, isReference: false, searchKeys: 'china beijing 中國 北京 大陸', distanceKm: 1710 },
    { name: '菲律賓 馬尼拉 (Manila)', utcOffset: 8.0, isReference: false, searchKeys: 'philippines manila 菲律賓 馬尼拉', distanceKm: 1170 },
    { name: '泰國 曼谷 (Bangkok)', utcOffset: 7.0, isReference: false, searchKeys: 'thailand bangkok 泰國 曼谷', distanceKm: 2530 },
    { name: '越南 河內 (Hanoi)', utcOffset: 7.0, isReference: false, searchKeys: 'vietnam hanoi 越南 河內', distanceKm: 1650 },
    { name: '印度 新德里 (New Delhi)', utcOffset: 5.5, isReference: false, searchKeys: 'india new delhi 印度 新德里', distanceKm: 4380 },
    { name: '法國 巴黎 (Paris)', utcOffset: 1.0, isReference: false, searchKeys: 'france paris 法國 巴黎 歐洲', distanceKm: 9840 },
    { name: '英國 倫敦 (London)', utcOffset: 0.0, isReference: false, searchKeys: 'uk england london 英國 倫敦', distanceKm: 9780 },
    { name: '美國 洛杉磯 (L.A.)', utcOffset: -8.0, isReference: false, searchKeys: 'usa america united states los angeles california 美國 西岸 洛杉磯 加州', distanceKm: 10920 }
  ];

  private masterCities: CityData[] = [];
  private defaultCities: CityData[] = [];
  displayedCities: CityData[] = [];
  scheduleRows: ScheduleRow[] = [];

  get totalRowsHeight(): number {
    return this.displayedCities.length * this.rowHeight;
  }

  get activeCity(): CityData | null {
    return this.hoveredCity ?? this.focusedCity ?? this.selectedCity;
  }

  ngOnInit(): void {
    this.initializePlannerDefaults();
    this.initializeOfficialDefaults();
    this.buildScheduleRows();
    this.rebuildCityLists();
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

    if (this.copiedGpsTimer) {
      clearTimeout(this.copiedGpsTimer);
    }
  }

  setActiveTab(tab: ActiveTab): void {
    this.activeTab = tab;
  }

  private initializePlannerDefaults(): void {
    const taipeiNow = this.getTaipeiNowParts();
    const yyyy = String(taipeiNow.year).padStart(4, '0');
    const mm = String(taipeiNow.month).padStart(2, '0');
    const dd = String(taipeiNow.day).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;

    this.plannerStartDate = today;
    this.plannerStartTime = '14:00';
    this.plannerCooldownStartDate = today;
    this.plannerCooldownStartTime = '18:00';
    this.plannerCooldownHours = 2;
  }

  private initializeOfficialDefaults(): void {
    const saoPauloIndex = this.eventLocations.findIndex(row =>
      row.country === '巴西' && row.city === '聖保羅'
    );

    this.officialLocationIndex = saoPauloIndex >= 0 ? saoPauloIndex : 0;
    this.officialLocalDate = this.plannerStartDate;
    this.officialLocalTime = '10:00';
  }

  get officialLocations(): EventLocation[] {
    return this.eventLocations;
  }

  getOfficialSelectedLocation(): EventLocation | null {
    return this.eventLocations[this.officialLocationIndex] ?? null;
  }

  normalizeOfficialTime(): void {
    this.officialLocalTime = this.normalizeTimeText(this.officialLocalTime);
  }

  getOfficialLocalDateTimeValue(): string {
    return `${this.officialLocalDate}T${this.normalizeTimeText(this.officialLocalTime)}`;
  }

  getFormattedOfficialLocalDateTime(): string {
    return this.formatPlannerDateTime(this.getOfficialLocalDateTimeValue());
  }

  getOfficialTaiwanDateTime(): string {
    const location = this.getOfficialSelectedLocation();
    const parsed = this.parseDateTimeLocal(this.getOfficialLocalDateTimeValue());

    if (!location || !parsed) {
      return '日期時間未設定';
    }

    const utcMs = this.getUtcMsFromZonedLocalTime(
      parsed.year,
      parsed.month,
      parsed.day,
      parsed.hour,
      parsed.minute,
      location.timeZone
    );

    const taipeiDisplayMs = utcMs + (8 * 60 * 60 * 1000);
    return this.formatTaipeiDisplayDateTime(taipeiDisplayMs);
  }

  getOfficialOffsetText(): string {
    const location = this.getOfficialSelectedLocation();
    const parsed = this.parseDateTimeLocal(this.getOfficialLocalDateTimeValue());

    if (!location || !parsed) {
      return '請先選擇地點與日期時間';
    }

    const utcMs = this.getUtcMsFromZonedLocalTime(
      parsed.year,
      parsed.month,
      parsed.day,
      parsed.hour,
      parsed.minute,
      location.timeZone
    );
    const locationOffset = this.getTimeZoneOffsetHoursAtUtc(utcMs, location.timeZone);
    const diff = 8 - locationOffset;

    if (diff === 0) {
      return `${location.city} 與台灣無時差`;
    }

    const diffText = this.formatHourDuration(Math.abs(diff));
    return diff > 0
      ? `台灣比 ${location.city} 快 ${diffText}`
      : `台灣比 ${location.city} 慢 ${diffText}`;
  }

  private buildScheduleRows(): void {
    this.scheduleRows = this.eventLocations.map(location => {
      const startAbsMinutes = (location.startDayOffset * 1440) + this.parseTimeToMinutes(location.startTime);
      return {
        ...location,
        startAbsMinutes
      };
    });
  }

  private rebuildCityLists(): void {
    const eventCities = this.eventLocations.map(location => this.eventLocationToCityData(location));
    this.defaultCities = eventCities;
    this.masterCities = [...eventCities, ...this.generalCities];
    this.displayedCities = [...this.defaultCities];
  }

  private eventLocationToCityData(location: EventLocation): CityData {
    return {
      name: `${location.flag} ${location.country} ${location.city} ${location.place}`,
      utcOffset: this.parseUtcOffsetFromTimezone(location.timeZone),
      isReference: location.country === '台灣' && location.city === '台北',
      searchKeys: `${location.searchKeys} ${location.lat.toFixed(5)} ${location.lon.toFixed(5)}`,
      distanceKm: this.calculateDistanceToTaipei(location.lat, location.lon)
    };
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

  onPlannerChanged(): void {
    // 保留 ngModelChange hook，畫面上的可銜接時間、最佳建議與清單會由 getter 即時計算更新。
  }

  normalizePlannerTimes(): void {
    this.plannerStartTime = this.normalizeTimeText(this.plannerStartTime);
    this.plannerCooldownStartTime = this.normalizeTimeText(this.plannerCooldownStartTime);
  }

  getPlannerStartDateTimeValue(): string {
    return `${this.plannerStartDate}T${this.normalizeTimeText(this.plannerStartTime)}`;
  }

  getPlannerCooldownStartDateTimeValue(): string {
    return `${this.plannerCooldownStartDate}T${this.normalizeTimeText(this.plannerCooldownStartTime)}`;
  }

  getFormattedPlannerStartDateTime(): string {
    return this.formatPlannerDateTime(this.getPlannerStartDateTimeValue());
  }

  getFormattedPlannerCooldownStartDateTime(): string {
    return this.formatPlannerDateTime(this.getPlannerCooldownStartDateTimeValue());
  }

  getFormattedPlannerReadyDateTime(): string {
    return this.formatAbsMinutes(this.getPlannerReadyAbsMinutes());
  }

  getLocationsAtPlannerStart(): ScheduleRow[] {
    const targetAbsMinutes = this.parsePlannerDateTimeToAbsMinutes(this.getPlannerStartDateTimeValue());
    return this.scheduleRows.filter(row => this.getScheduleStartAbsMinutes(row) === targetAbsMinutes);
  }

  getScheduleStartAbsMinutes(row: ScheduleRow): number {
    return this.getPlannerStartAbsMinutes() + this.getScheduleDeltaFromTaiwan(row);
  }

  private getScheduleDeltaFromTaiwan(row: ScheduleRow): number {
    const taiwanReferenceStartAbsMinutes = this.getTaiwanReferenceStartAbsMinutes();
    const deltaMinutes = row.startAbsMinutes - taiwanReferenceStartAbsMinutes;

    // 活動時段表要以台灣目前活動開始日期時間為第一筆，
    // 圖片中比台灣早的時區，應視為下一輪往後銜接，而不是排在台灣前面。
    return deltaMinutes < 0 ? deltaMinutes + 1440 : deltaMinutes;
  }

  isBestRecommendation(row: ScheduleRow): boolean {
    return row === this.getBestRecommendation();
  }

  private getPlannerStartAbsMinutes(): number {
    return this.parsePlannerDateTimeToAbsMinutes(this.getPlannerStartDateTimeValue());
  }

  private getTaiwanReferenceStartAbsMinutes(): number {
    const taiwanRow = this.scheduleRows.find(row => row.country === '台灣' && row.city === '台北');
    return taiwanRow ? taiwanRow.startAbsMinutes : 14 * 60;
  }

  getPlannerReadyAbsMinutes(): number {
    const cooldownStartAbsMinutes = this.parsePlannerDateTimeToAbsMinutes(this.getPlannerCooldownStartDateTimeValue());
    const cooldownMinutes = Math.round(Number(this.plannerCooldownHours || 0) * 60);
    return cooldownStartAbsMinutes + cooldownMinutes;
  }

  getPlannerRows(): ScheduleRow[] {
    const readyAbs = this.getPlannerReadyAbsMinutes();
    return this.scheduleRows
      .filter(row => this.getScheduleStartAbsMinutes(row) >= readyAbs)
      .sort((a, b) => this.getScheduleStartAbsMinutes(a) - this.getScheduleStartAbsMinutes(b));
  }

  getBestRecommendation(): ScheduleRow | null {
    const rows = this.getPlannerRows();
    return rows.length > 0 ? rows[0] : null;
  }

  getRecommendationReason(row: ScheduleRow): string {
    const readyAbs = this.getPlannerReadyAbsMinutes();
    const waitMinutes = this.getScheduleStartAbsMinutes(row) - readyAbs;
    if (waitMinutes === 0) {
      return '剛好銜接';
    }

    const h = Math.floor(waitMinutes / 60);
    const m = waitMinutes % 60;
    if (h > 0 && m > 0) {
      return `冷卻完成後再等 ${h} 小時 ${m} 分`;
    }
    if (h > 0) {
      return `冷卻完成後再等 ${h} 小時`;
    }
    return `冷卻完成後再等 ${m} 分`;
  }

  getFilteredScheduleRows(): ScheduleRow[] {
    const keyword = this.eventSearchText.trim().toLowerCase();

    const rows = keyword
      ? this.scheduleRows.filter(row => {
          const gps = `${row.lat.toFixed(5)},${row.lon.toFixed(5)}`;
          return `${row.country} ${row.city} ${row.place} ${row.searchKeys} ${gps}`.toLowerCase().includes(keyword);
        })
      : [...this.scheduleRows];

    return rows.sort((a, b) => this.getScheduleStartAbsMinutes(a) - this.getScheduleStartAbsMinutes(b));
  }

  getNorthLocations(): ScheduleRow[] {
    return this.scheduleRows.filter(row => row.lat >= 0);
  }

  getSouthLocations(): ScheduleRow[] {
    return this.scheduleRows.filter(row => row.lat < 0);
  }

  getEastLocations(): ScheduleRow[] {
    return this.scheduleRows.filter(row => row.lon >= 0);
  }

  getWestLocations(): ScheduleRow[] {
    return this.scheduleRows.filter(row => row.lon < 0);
  }

  getNorthSouth(row: EventLocation): string {
    return row.lat >= 0 ? '北半球' : '南半球';
  }

  getEastWest(row: EventLocation): string {
    return row.lon >= 0 ? '東半球' : '西半球';
  }

  getGpsText(row: EventLocation): string {
    return `${row.lat.toFixed(5)},${row.lon.toFixed(5)}`;
  }

  isGpsCopied(row: EventLocation): boolean {
    return this.copiedGpsText === this.getGpsText(row);
  }

  copyGps(row: EventLocation): void {
    const gps = this.getGpsText(row);

    const markCopied = () => {
      this.copiedGpsText = gps;

      if (this.copiedGpsTimer) {
        clearTimeout(this.copiedGpsTimer);
      }

      this.copiedGpsTimer = setTimeout(() => {
        if (this.copiedGpsText === gps) {
          this.copiedGpsText = null;
        }
      }, 1800);
    };

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(gps)
        .then(markCopied)
        .catch(() => {
          this.copyGpsWithFallback(gps);
          markCopied();
        });
      return;
    }

    this.copyGpsWithFallback(gps);
    markCopied();
  }

  private copyGpsWithFallback(gps: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = gps;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
    } catch {
      console.warn('Clipboard copy failed');
    } finally {
      document.body.removeChild(textarea);
    }
  }

  onSearchChange(): void {
    this.selectedCity = null;
    this.hoveredCity = null;
    this.focusedCity = null;

    const keyword = this.searchText.trim().toLowerCase();

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!keyword) {
      this.displayedCities = [...this.defaultCities];
      return;
    }

    const results = this.masterCities.filter(city =>
      city.searchKeys.toLowerCase().includes(keyword) ||
      city.name.toLowerCase().includes(keyword)
    );

    if (results.length > 0) {
      this.displayedCities = results;
    } else {
      this.displayedCities = [{
        name: `📡 正在全球網路定位 "${this.searchText}" ...`,
        utcOffset: 0.0,
        isReference: false,
        searchKeys: '',
        distanceKm: -1
      }];

      this.searchTimeout = setTimeout(() => {
        this.fetchDynamicCityData(this.searchText.trim());
      }, 800);
    }
  }

  async fetchDynamicCityData(keyword: string): Promise<void> {
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(keyword)}&count=1&language=zh`);
      const data = await response.json();

      if (data && data.results && data.results.length > 0) {
        const result = data.results[0];
        const lat = result.latitude;
        const lon = result.longitude;
        const tzName = result.timezone;
        const country = result.country ? `, ${result.country}` : '';

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
        name: '連線 API 失敗，無法動態獲取資料',
        utcOffset: 0.0,
        isReference: false,
        searchKeys: '',
        distanceKm: -1
      }];
    }
  }

  calculateDistanceToTaipei(lat: number, lon: number): number {
    const R = 6371;
    const dLat = (lat - this.taipeiLat) * Math.PI / 180;
    const dLon = (lon - this.taipeiLon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.taipeiLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

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
        const offsetStr = tzPart.value.replace('GMT', '');
        if (!offsetStr) return 0;

        const sign = offsetStr.startsWith('-') ? -1 : 1;
        const timeParts = offsetStr.replace(/[+-]/, '').split(':');
        const h = parseInt(timeParts[0], 10);
        const m = timeParts.length > 1 ? parseInt(timeParts[1], 10) : 0;

        return (h + (m / 60)) * sign;
      }
    } catch (e) {
      console.error('Timezone parsing failed for:', timeZoneName);
    }
    return 0;
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
      return '與台灣無時差';
    }
  }

  private parseTimeToMinutes(time: string): number {
    const [h, m] = (time || '00:00').split(':').map(v => Number(v));
    const safeH = Number.isFinite(h) ? Math.min(Math.max(h, 0), 23) : 0;
    const safeM = Number.isFinite(m) ? Math.min(Math.max(m, 0), 59) : 0;
    return safeH * 60 + safeM;
  }

  formatAbsMinutes(absMinutes: number): string {
    const baseTaipeiDateStartDisplayMs = this.getPlannerBaseDateStartDisplayMs();
    const displayMs = baseTaipeiDateStartDisplayMs + (absMinutes * 60 * 1000);
    return this.formatTaipeiDisplayDateTime(displayMs);
  }

  formatPlannerDateTime(value: string): string {
    const parsed = this.parseDateTimeLocal(value);
    if (!parsed) {
      return '日期時間未設定';
    }

    // 這裡只做「台灣畫面日期時間」格式化，不再扣 UTC+8。
    // 使用者輸入 2026-06-22 18:00，畫面就必須顯示 2026-06-22 18:00。
    const displayMs = Date.UTC(
      parsed.year,
      parsed.month - 1,
      parsed.day,
      parsed.hour,
      parsed.minute,
      0
    );
    return this.formatTaipeiDisplayDateTime(displayMs);
  }

  private parsePlannerDateTimeToAbsMinutes(value: string): number {
    const parsed = this.parseDateTimeLocal(value);
    const baseTaipeiDateStartUtcMs = this.getPlannerBaseDateStartUtcMs();

    if (!parsed) {
      return 0;
    }

    const valueTaipeiDateStartUtcMs = this.getTaipeiDateStartUtcMs(parsed.year, parsed.month, parsed.day);
    const dateOffsetMinutes = Math.round((valueTaipeiDateStartUtcMs - baseTaipeiDateStartUtcMs) / 60000);
    return dateOffsetMinutes + (parsed.hour * 60) + parsed.minute;
  }

  private getPlannerBaseDateStartUtcMs(): number {
    const parsed = this.parseDateTimeLocal(this.getPlannerStartDateTimeValue());
    if (!parsed) {
      return this.getFallbackTaipeiDateStartUtcMs();
    }

    // 活動清單中的第 0 天，就是使用者輸入的「目前活動開始日期」。
    // 這個函式保留給舊有 UTC 基準計算使用。
    return this.getTaipeiDateStartUtcMs(parsed.year, parsed.month, parsed.day);
  }

  private getPlannerBaseDateStartDisplayMs(): number {
    const parsed = this.parseDateTimeLocal(this.getPlannerStartDateTimeValue());
    if (!parsed) {
      const taipeiNow = this.getTaipeiNowParts();
      return Date.UTC(taipeiNow.year, taipeiNow.month - 1, taipeiNow.day, 0, 0, 0);
    }

    // 活動清單中的第 0 天，就是使用者輸入的「目前活動開始日期」。
    // 圖片上的 20/xx 不能寫死，正式使用時由使用者輸入日期決定。
    // 第 1 天資料則自然顯示為使用者輸入日期的隔日。
    return Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0);
  }

  private normalizeTimeText(value: string): string {
    const text = (value || '').trim();
    const colonMatch = /^(\d{1,2}):(\d{1,2})$/.exec(text);
    const compactMatch = /^(\d{1,2})(\d{2})$/.exec(text);

    let h = 0;
    let m = 0;

    if (colonMatch) {
      h = Number(colonMatch[1]);
      m = Number(colonMatch[2]);
    } else if (compactMatch) {
      h = Number(compactMatch[1]);
      m = Number(compactMatch[2]);
    } else {
      return '00:00';
    }

    const safeH = Number.isFinite(h) ? Math.min(Math.max(h, 0), 23) : 0;
    const safeM = Number.isFinite(m) ? Math.min(Math.max(m, 0), 59) : 0;
    return `${String(safeH).padStart(2, '0')}:${String(safeM).padStart(2, '0')}`;
  }

  private getUtcMsFromZonedLocalTime(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): number {
    const desiredWallMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    let utcMs = desiredWallMs;

    // 將「指定時區的牆上時間」反推成 UTC。用迭代可處理大多數 DST / 時區偏移情況。
    for (let i = 0; i < 4; i++) {
      const zonedParts = this.getZonedDateTimeParts(new Date(utcMs), timeZone);
      const actualWallMs = Date.UTC(
        zonedParts.year,
        zonedParts.month - 1,
        zonedParts.day,
        zonedParts.hour,
        zonedParts.minute,
        0
      );
      const diffMs = actualWallMs - desiredWallMs;

      if (diffMs === 0) {
        break;
      }

      utcMs -= diffMs;
    }

    return utcMs;
  }

  private getTimeZoneOffsetHoursAtUtc(utcMs: number, timeZone: string): number {
    const zonedParts = this.getZonedDateTimeParts(new Date(utcMs), timeZone);
    const zonedWallMs = Date.UTC(
      zonedParts.year,
      zonedParts.month - 1,
      zonedParts.day,
      zonedParts.hour,
      zonedParts.minute,
      0
    );

    return (zonedWallMs - utcMs) / (60 * 60 * 1000);
  }

  private getZonedDateTimeParts(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string): number => Number(parts.find(p => p.type === type)?.value ?? 0);

    return {
      year: getPart('year'),
      month: getPart('month'),
      day: getPart('day'),
      hour: getPart('hour'),
      minute: getPart('minute')
    };
  }

  private formatHourDuration(hours: number): string {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (h > 0 && m > 0) {
      return `${h} 小時 ${m} 分`;
    }

    if (h > 0) {
      return `${h} 小時`;
    }

    return `${m} 分`;
  }

  private parseDateTimeLocal(value: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
    if (!match) {
      return null;
    }

    const [, y, mo, d, h, mi] = match;
    return {
      year: Number(y),
      month: Number(mo),
      day: Number(d),
      hour: Math.min(Math.max(Number(h), 0), 23),
      minute: Math.min(Math.max(Number(mi), 0), 59)
    };
  }

  private formatTaipeiDisplayDateTime(displayMs: number): string {
    const date = new Date(displayMs);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mi = String(date.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

}
