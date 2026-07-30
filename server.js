const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

const API_BASE = 'https://solid-computing-machine-uz8r.onrender.com';
const sessionData = {};
const lastData = {};
const predHistory = {};

// ============================================================
// UTILS
// ============================================================
function toArr(str) {
    return str ? str.split('').filter(c => ['B','P','T'].includes(c)) : [];
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
function mean(arr) { return arr.length ? sum(arr) / arr.length : 0; }

// ============================================================
// PHÂN TÍCH THỰC TẾ - KHÔNG CHẠY THEO CẦU MÙ QUÁNG
// ============================================================

// M01: PHÂN TÍCH TẦN SUẤT THỰC TẾ
function m01_realFrequency(arr) {
    const cnt = { B: 0, P: 0, T: 0 };
    for (const c of arr) if (cnt[c] !== undefined) cnt[c]++;
    const N = arr.length;
    
    const realB = (cnt.B / N) * 100;
    const realP = (cnt.P / N) * 100;
    const realT = (cnt.T / N) * 100;
    
    const stdB = 45.86, stdP = 44.62, stdT = 9.52;
    const devB = realB - stdB;
    const devP = realP - stdP;
    const devT = realT - stdT;
    
    let vote = { B: 0.46, P: 0.44, T: 0.10 };
    
    // Cửa nào đang thiếu so với chuẩn -> khả năng về
    if (devB < -5) {
        const boost = clamp(Math.abs(devB) / 30, 0.05, 0.25);
        vote.B = 0.46 + boost;
        vote.P = 0.44 - boost * 0.6;
        vote.T = 0.10 - boost * 0.4;
    }
    else if (devP < -5) {
        const boost = clamp(Math.abs(devP) / 30, 0.05, 0.25);
        vote.P = 0.44 + boost;
        vote.B = 0.46 - boost * 0.6;
        vote.T = 0.10 - boost * 0.4;
    }
    else if (devT < -3) {
        const boost = clamp(Math.abs(devT) / 20, 0.02, 0.15);
        vote.T = 0.10 + boost;
        vote.B = 0.46 - boost * 0.5;
        vote.P = 0.44 - boost * 0.5;
    }
    
    const s = vote.B + vote.P + vote.T;
    return { 
        vote: { B: vote.B/s, P: vote.P/s, T: vote.T/s }, 
        weight: 2.0,
        meta: { realB: Math.round(realB*10)/10, realP: Math.round(realP*10)/10, realT: Math.round(realT*10)/10, devB: Math.round(devB*10)/10, devP: Math.round(devP*10)/10 }
    };
}

// M02: PHÂN TÍCH CỬA ĐANG "NGUỘI" (COLD)
function m02_coldAnalysis(arr) {
    if (arr.length < 20) return { vote: {B:0.46,P:0.44,T:0.10}, weight:0.5 };
    
    const recent = arr.slice(-20);
    const cnt = { B: 0, P: 0, T: 0 };
    for (const c of recent) if (cnt[c] !== undefined) cnt[c]++;
    
    let minCount = 20, minKey = 'B';
    for (const k of ['B', 'P', 'T']) {
        if (cnt[k] < minCount) {
            minCount = cnt[k];
            minKey = k;
        }
    }
    
    let vote = { B: 0.46, P: 0.44, T: 0.10 };
    if (minCount < 5) {
        const boost = clamp((5 - minCount) / 10, 0.05, 0.30);
        if (minKey === 'B') {
            vote.B = 0.46 + boost;
            vote.P = 0.44 - boost * 0.6;
            vote.T = 0.10 - boost * 0.4;
        } else if (minKey === 'P') {
            vote.P = 0.44 + boost;
            vote.B = 0.46 - boost * 0.6;
            vote.T = 0.10 - boost * 0.4;
        } else {
            vote.T = 0.10 + boost;
            vote.B = 0.46 - boost * 0.5;
            vote.P = 0.44 - boost * 0.5;
        }
    }
    
    const s = vote.B + vote.P + vote.T;
    return { 
        vote: { B: vote.B/s, P: vote.P/s, T: vote.T/s }, 
        weight: 1.8,
        meta: { cold: minKey, count: minCount }
    };
}

// M03: PHÂN TÍCH ZIGZAG (ĐẢO CHIỀU)
function m03_zigzagAnalysis(arr) {
    if (arr.length < 15) return { vote: {B:0.46,P:0.44,T:0.10}, weight:0.5 };
    
    const recent = arr.slice(-15);
    let switches = 0;
    for (let i = 1; i < recent.length; i++) {
        if (recent[i] !== recent[i-1] && recent[i] !== 'T' && recent[i-1] !== 'T') {
            switches++;
        }
    }
    const switchRate = switches / (recent.length - 1);
    
    let vote = { B: 0.46, P: 0.44, T: 0.10 };
    const last = recent[recent.length - 1];
    
    if (switchRate > 0.6) {
        // CHOP mode -> đảo chiều
        if (last === 'B') {
            vote.B = 0.40;
            vote.P = 0.50;
            vote.T = 0.10;
        } else if (last === 'P') {
            vote.B = 0.50;
            vote.P = 0.40;
            vote.T = 0.10;
        }
    } else if (switchRate < 0.3) {
        // STREAK mode -> theo xu hướng (nhưng giảm dần)
        if (last === 'B') {
            vote.B = 0.48;
            vote.P = 0.42;
            vote.T = 0.10;
        } else if (last === 'P') {
            vote.B = 0.42;
            vote.P = 0.48;
            vote.T = 0.10;
        }
    }
    
    const s = vote.B + vote.P + vote.T;
    return { 
        vote: { B: vote.B/s, P: vote.P/s, T: vote.T/s }, 
        weight: 1.6,
        meta: { switchRate: Math.round(switchRate*100), mode: switchRate > 0.6 ? 'CHOP' : switchRate < 0.3 ? 'STREAK' : 'MIXED' }
    };
}

// M04: PHÂN TÍCH PATTERN THỰC TẾ
function m04_patternAnalysis(arr) {
    if (arr.length < 20) return { vote: {B:0.46,P:0.44,T:0.10}, weight:0.5 };
    
    const runs = [];
    let cur = { c: arr[0], n: 1 };
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === cur.c) cur.n++;
        else { runs.push({...cur}); cur = { c: arr[i], n: 1 }; }
    }
    runs.push({...cur});
    
    const L = runs.length;
    if (L < 3) return { vote: {B:0.46,P:0.44,T:0.10}, weight:0.3 };
    
    const lastRuns = runs.slice(-3);
    const rn = lastRuns.map(r => r.n);
    const rc = lastRuns.map(r => r.c);
    
    let vote = { B: 0.46, P: 0.44, T: 0.10 };
    let pattern = 'NONE';
    
    if (rn[0] === 1 && rn[1] === 2 && rn[2] === 1) {
        pattern = '1-2-1';
        const target = rc[1];
        if (target === 'B') {
            vote.B = 0.58;
            vote.P = 0.32;
            vote.T = 0.10;
        } else {
            vote.B = 0.32;
            vote.P = 0.58;
            vote.T = 0.10;
        }
    }
    else if (rn[0] === 2 && rn[1] === 1 && rn[2] === 2) {
        pattern = '2-1-2';
        const flip = rc[2] === 'B' ? 'P' : 'B';
        if (flip === 'B') {
            vote.B = 0.55;
            vote.P = 0.35;
            vote.T = 0.10;
        } else {
            vote.B = 0.35;
            vote.P = 0.55;
            vote.T = 0.10;
        }
    }
    else if (rn[0] === 2 && rn[1] === 2 && rn[2] === 2) {
        pattern = '2-2-2';
        const target = rc[0];
        if (target === 'B') {
            vote.B = 0.55;
            vote.P = 0.35;
            vote.T = 0.10;
        } else {
            vote.B = 0.35;
            vote.P = 0.55;
            vote.T = 0.10;
        }
    }
    
    const s = vote.B + vote.P + vote.T;
    return { 
        vote: { B: vote.B/s, P: vote.P/s, T: vote.T/s }, 
        weight: 1.7,
        meta: { pattern }
    };
}

// M05: PHÂN TÍCH BIẾN ĐỘNG (VOLATILITY)
function m05_volatilityAnalysis(arr) {
    if (arr.length < 20) return { vote: {B:0.46,P:0.44,T:0.10}, weight:0.3 };
    
    const recent = arr.slice(-20);
    let switches = 0;
    for (let i = 1; i < recent.length; i++) {
        if (recent[i] !== recent[i-1] && recent[i] !== 'T' && recent[i-1] !== 'T') {
            switches++;
        }
    }
    const vol = switches / (recent.length - 1);
    
    let vote = { B: 0.46, P: 0.44, T: 0.10 };
    if (vol < 0.3) {
        const last = recent[recent.length - 1];
        if (last === 'B') {
            vote.B = 0.52;
            vote.P = 0.38;
            vote.T = 0.10;
        } else if (last === 'P') {
            vote.B = 0.38;
            vote.P = 0.52;
            vote.T = 0.10;
        }
    }
    
    const s = vote.B + vote.P + vote.T;
    return { 
        vote: { B: vote.B/s, P: vote.P/s, T: vote.T/s }, 
        weight: 1.2,
        meta: { vol: Math.round(vol*100) }
    };
}

// M06: PHÂN TÍCH CHU KỲ TIE
function m06_tieCycle(arr) {
    const tp = [];
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === 'T') tp.push(i);
    }
    
    if (tp.length < 2) return { vote: {B:0.46,P:0.44,T:0.10}, weight: 0.5 };
    
    const gaps = [];
    for (let i = 1; i < tp.length; i++) {
        gaps.push(tp[i] - tp[i-1]);
    }
    const avgGap = mean(gaps);
    const lastGap = arr.length - 1 - tp[tp.length - 1];
    const gapRatio = lastGap / avgGap;
    
    let vote = { B: 0.46, P: 0.44, T: 0.10 };
    let tieWeight = 1.0;
    
    if (gapRatio > 1.2 && avgGap < 15) {
        const boost = clamp(gapRatio * 0.08, 0.02, 0.15);
        vote.T = 0.10 + boost;
        vote.B = 0.46 - boost * 0.5;
        vote.P = 0.44 - boost * 0.5;
        tieWeight = 1.8;
    }
    
    const s = vote.B + vote.P + vote.T;
    return { 
        vote: { B: vote.B/s, P: vote.P/s, T: vote.T/s }, 
        weight: tieWeight,
        meta: { avgGap: Math.round(avgGap), gapRatio: Math.round(gapRatio*100)/100 }
    };
}

// M07: PHÂN TÍCH CÂN BẰNG B/P
function m07_balanceAnalysis(arr) {
    if (arr.length < 20) return { vote: {B:0.46,P:0.44,T:0.10}, weight:0.3 };
    
    const cnt = { B: 0, P: 0, T: 0 };
    for (const c of arr) if (cnt[c] !== undefined) cnt[c]++;
    const N = arr.length;
    
    const bPct = cnt.B / N * 100;
    const pPct = cnt.P / N * 100;
    const diff = bPct - pPct;
    
    let vote = { B: 0.46, P: 0.44, T: 0.10 };
    
    // Nếu B đang nhiều hơn P quá nhiều -> khả năng P về để cân bằng
    if (diff > 10) {
        const boost = clamp(diff / 40, 0.05, 0.20);
        vote.P = 0.44 + boost;
        vote.B = 0.46 - boost * 0.7;
        vote.T = 0.10 - boost * 0.3;
    }
    // Nếu P đang nhiều hơn B quá nhiều -> khả năng B về để cân bằng
    else if (diff < -10) {
        const boost = clamp(Math.abs(diff) / 40, 0.05, 0.20);
        vote.B = 0.46 + boost;
        vote.P = 0.44 - boost * 0.7;
        vote.T = 0.10 - boost * 0.3;
    }
    
    const s = vote.B + vote.P + vote.T;
    return { 
        vote: { B: vote.B/s, P: vote.P/s, T: vote.T/s }, 
        weight: 1.5,
        meta: { diff: Math.round(diff*10)/10 }
    };
}

// M08: PHÂN TÍCH XU HƯỚNG GẦN NHẤT (NHƯNG KHÔNG BÁM MÙ)
function m08_recentTrend(arr) {
    if (arr.length < 10) return { vote: {B:0.46,P:0.44,T:0.10}, weight:0.3 };
    
    const recent = arr.slice(-10);
    const cnt = { B: 0, P: 0, T: 0 };
    for (const c of recent) if (cnt[c] !== undefined) cnt[c]++;
    
    // Nếu 10 ván gần nhất có 1 cửa quá áp đảo -> khả năng cửa kia về
    let vote = { B: 0.46, P: 0.44, T: 0.10 };
    
    if (cnt.B >= 7) {
        vote.B = 0.40;
        vote.P = 0.50;
        vote.T = 0.10;
    } else if (cnt.P >= 7) {
        vote.B = 0.50;
        vote.P = 0.40;
        vote.T = 0.10;
    } else if (cnt.B <= 2 && cnt.P <= 2 && cnt.T >= 6) {
        vote.T = 0.12;
        vote.B = 0.44;
        vote.P = 0.44;
    }
    
    const s = vote.B + vote.P + vote.T;
    return { 
        vote: { B: vote.B/s, P: vote.P/s, T: vote.T/s }, 
        weight: 1.3,
        meta: { recentB: cnt.B, recentP: cnt.P, recentT: cnt.T }
    };
}

// ============================================================
// MASTER PREDICTOR - KHÔNG CHẠY THEO CẦU
// ============================================================
function predictVIP(history, tableId = 'UNKNOWN') {
    const DEFAULT = {
        banker: { prediction: 'Banker', rate: 46, confidence: 50, signal: 'NEUTRAL' },
        player: { prediction: 'Player', rate: 44, confidence: 50, signal: 'NEUTRAL' },
        tie: { prediction: 'Tie', rate: 10, confidence: 50, signal: 'NEUTRAL' },
        recommend: 'Chờ',
        recommendRate: 0,
        recommendConf: 0,
        pattern: 'Chưa đủ dữ liệu',
        cau_goc: history || '',
        stats: {}
    };

    if (!history || history.length < 10) return DEFAULT;
    const arr = toArr(history);
    if (arr.length < 10) return DEFAULT;

    // ── CHẠY CÁC MODULE PHÂN TÍCH ──
    const modules = [
        m01_realFrequency(arr),
        m02_coldAnalysis(arr),
        m03_zigzagAnalysis(arr),
        m04_patternAnalysis(arr),
        m05_volatilityAnalysis(arr),
        m06_tieCycle(arr),
        m07_balanceAnalysis(arr),
        m08_recentTrend(arr),
    ];

    // ── WEIGHTED ENSEMBLE ──
    let totalW = 0, sumB = 0, sumP = 0, sumT = 0;
    for (const m of modules) {
        if (!m || m.weight <= 0) continue;
        sumB += m.vote.B * m.weight;
        sumP += m.vote.P * m.weight;
        sumT += m.vote.T * m.weight;
        totalW += m.weight;
    }
    
    let rB = (sumB / totalW) * 100;
    let rP = (sumP / totalW) * 100;
    let rT = (sumT / totalW) * 100;

    // ── NORMALIZE ──
    const rawSum = rB + rP + rT;
    rB = (rB / rawSum) * 100;
    rP = (rP / rawSum) * 100;
    rT = (rT / rawSum) * 100;

    // ── CONFIDENCE ──
    const avgOthersB = (rP + rT) / 2;
    const avgOthersP = (rB + rT) / 2;
    const avgOthersT = (rB + rP) / 2;
    const confB = clamp(50 + (rB - avgOthersB) * 2.5, 40, 95);
    const confP = clamp(50 + (rP - avgOthersP) * 2.5, 40, 95);
    const confT = clamp(50 + (rT - avgOthersT) * 2.5, 35, 90);

    // ── TÌM CỬA TỐT NHẤT ──
    const sides = [
        { name: 'Banker', rate: Math.round(rB), conf: Math.round(confB) },
        { name: 'Player', rate: Math.round(rP), conf: Math.round(confP) },
        { name: 'Tie', rate: Math.round(rT), conf: Math.round(confT) }
    ];
    
    sides.sort((a, b) => b.conf - a.conf);
    const best = sides[0];
    const second = sides[1];
    
    // ── ĐIỀU KIỆN DỰ ĐOÁN ──
    let canPredict = false;
    let finalRecommend = 'Chờ';
    let finalRate = 0;
    let finalConf = 0;
    
    if (best.conf >= 58 && (best.conf - second.conf) >= 8) {
        canPredict = true;
        finalRecommend = best.name;
        finalRate = best.rate;
        finalConf = best.conf;
    }

    function signal(rate, conf) {
        if (conf >= 80) return '🔥 STRONG';
        if (conf >= 70) return '⚡ MEDIUM';
        if (conf >= 60) return '💡 WEAK';
        return '⏳ CHỜ';
    }

    // ── PATTERN ──
    const freq = m01_realFrequency(arr);
    const cold = m02_coldAnalysis(arr);
    const zz = m03_zigzagAnalysis(arr);
    const pat = m04_patternAnalysis(arr);
    const tie = m06_tieCycle(arr);
    const bal = m07_balanceAnalysis(arr);

    let pattern = 'Cầu đan xen';
    if (cold.meta?.count < 5 && cold.meta?.count > 0) {
        pattern = `❄️ Cửa ${cold.meta.cold} đang nguội (${cold.meta.count}/20) -> khả năng về`;
    } else if (zz.meta?.mode === 'CHOP') {
        pattern = `🔄 Chop Mode (${zz.meta.switchRate}% đảo chiều)`;
    } else if (pat.meta?.pattern !== 'NONE') {
        pattern = `📐 Pattern ${pat.meta.pattern}`;
    } else if (tie.meta?.gapRatio > 1.2 && tie.meta?.gapRatio < 3) {
        pattern = `🔮 Tie sắp về (gap=${tie.meta.avgGap})`;
    } else if (Math.abs(bal.meta?.diff || 0) > 10) {
        pattern = `⚖️ Cân bằng B/P (chênh ${Math.round(bal.meta.diff)}%)`;
    } else {
        pattern = `📊 Phân tích đa chiều`;
    }

    // ── ROUND ──
    let b = Math.round(rB), p = Math.round(rP), t = Math.round(rT);
    const rs = b + p + t;
    if (rs !== 100) {
        const diff = 100 - rs;
        if (b >= p && b >= t) b += diff;
        else if (p >= b && p >= t) p += diff;
        else t += diff;
    }

    // Store history
    if (!predHistory[tableId]) predHistory[tableId] = [];
    if (canPredict) {
        predHistory[tableId].push(finalRecommend[0]);
    } else {
        predHistory[tableId].push('W');
    }
    if (predHistory[tableId].length > 25) predHistory[tableId].shift();

    return {
        banker: {
            prediction: 'Banker',
            rate: b,
            confidence: Math.round(confB),
            signal: signal(b, confB),
            label: `${b}% | Conf: ${Math.round(confB)}% | ${signal(b, confB)}`
        },
        player: {
            prediction: 'Player',
            rate: p,
            confidence: Math.round(confP),
            signal: signal(p, confP),
            label: `${p}% | Conf: ${Math.round(confP)}% | ${signal(p, confP)}`
        },
        tie: {
            prediction: 'Tie',
            rate: t,
            confidence: Math.round(confT),
            signal: signal(t, confT),
            label: `${t}% | Conf: ${Math.round(confT)}% | ${signal(t, confT)}`
        },
        recommend: finalRecommend,
        recommendRate: finalRate,
        recommendConf: finalConf,
        canPredict: canPredict,
        pattern,
        cau_goc: history,
        stats: {
            B: b, P: p, T: t,
            realB: freq.meta?.realB,
            realP: freq.meta?.realP,
            realT: freq.meta?.realT,
            devB: freq.meta?.devB,
            devP: freq.meta?.devP,
            cold: cold.meta?.cold,
            coldCount: cold.meta?.count,
            mode: zz.meta?.mode,
            switchRate: zz.meta?.switchRate,
            pattern: pat.meta?.pattern,
            tieGap: tie.meta?.avgGap,
            gapRatio: tie.meta?.gapRatio,
            balance: bal.meta?.diff,
            recentB: m08_recentTrend(arr).meta?.recentB,
            recentP: m08_recentTrend(arr).meta?.recentP,
            recentT: m08_recentTrend(arr).meta?.recentT,
            diff: Math.round(best.conf - second.conf),
            modules: 8
        }
    };
}

// ============================================================
// API ROUTES
// ============================================================
async function fetchTableData(tableId) {
    try {
        const url = `${API_BASE}/api/baccarat/${tableId.toUpperCase()}`;
        console.log(`📡 ${url}`);
        const res = await axios.get(url, { timeout: 15000 });
        if (res.data?.success && res.data?.data) return res.data.data.result || '';
        return '';
    } catch (e) {
        console.error(`❌ ${tableId}:`, e.message);
        return '';
    }
}

// ── API: Dự đoán 1 bàn ──
app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const cauGoc = await fetchTableData(tableId);
        if (!cauGoc) {
            return res.json({ success: false, message: `Không tìm thấy bàn ${tableId}` });
        }

        const old = lastData[tableId] || '';
        const isNew = cauGoc !== old && cauGoc.length > old.length;
        lastData[tableId] = cauGoc;
        if (!sessionData[tableId]) sessionData[tableId] = 0;
        if (isNew) sessionData[tableId]++;

        const r = predictVIP(cauGoc, tableId);

        const result = {
            phiên: sessionData[tableId],
            cầu_gốc: cauGoc,
            Dự_đoán: r.recommend,
            Tỉ_lệ: r.canPredict ? `${r.recommendRate}%` : 'Chờ',
            Độ_tin_cậy: r.canPredict ? `${r.recommendConf}%` : 'Chờ',
            BANKER: `${r.banker.rate}% (${r.banker.signal})`,
            PLAYER: `${r.player.rate}% (${r.player.signal})`,
            TIE: `${r.tie.rate}% (${r.tie.signal})`,
            Cầu: r.pattern,
            chênh_lệch: r.canPredict ? `${r.stats.diff}%` : 'Chưa đủ',
            trạng_thái: r.canPredict ? '✅ CÓ DỰ ĐOÁN' : '⏳ CHỜ THÊM',
            phân_tích: {
                'Tỉ lệ thực tế': `B=${r.stats.realB}% P=${r.stats.realP}% T=${r.stats.realT}%`,
                'Độ lệch chuẩn': `B=${r.stats.devB}% P=${r.stats.devP}%`,
                'Cửa nguội': r.stats.cold ? `${r.stats.cold} (${r.stats.coldCount}/20)` : 'Không',
                'Chế độ': r.stats.mode || 'MIXED',
                'Pattern': r.stats.pattern || 'Không',
                'Cân bằng B/P': r.stats.balance ? `${r.stats.balance}%` : 'Cân bằng',
                '10 ván gần': `B=${r.stats.recentB} P=${r.stats.recentP} T=${r.stats.recentT}`
            }
        };

        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── API: Dự đoán tất cả ──
app.get('/api/predict/all', async (req, res) => {
    try {
        const tableIds = ['C01', 'C02', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C15', 'C16', 'C17', 'C18', 'C19', 'C20'];
        const predictions = {};

        for (const id of tableIds) {
            const cauGoc = await fetchTableData(id);
            if (!cauGoc) continue;

            const old = lastData[id] || '';
            const isNew = cauGoc !== old && cauGoc.length > old.length;
            lastData[id] = cauGoc;
            if (!sessionData[id]) sessionData[id] = 0;
            if (isNew) sessionData[id]++;

            const r = predictVIP(cauGoc, id);
            
            predictions[id] = {
                cầu_gốc: cauGoc,
                phiên: sessionData[id],
                Dự_đoán: r.recommend,
                Tỉ_lệ: r.canPredict ? `${r.recommendRate}%` : 'Chờ',
                Độ_tin_cậy: r.canPredict ? `${r.recommendConf}%` : 'Chờ',
                BANKER: `${r.banker.rate}%`,
                PLAYER: `${r.player.rate}%`, 
                TIE: `${r.tie.rate}%`,
                Cầu: r.pattern,
                trạng_thái: r.canPredict ? '✅' : '⏳'
            };
        }

        res.json({
            success: true,
            engine: 'VIP-v18.0-NO-STREAK-FIX',
            timestamp: new Date().toISOString(),
            author: '@tranhoang2286',
            predictions
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── API: Lấy dữ liệu bàn ──
app.get('/api/baccarat/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const result = await fetchTableData(tableId);
        if (result) {
            res.json({ success: true, data: { table: tableId, result, shoeId: '', round: '' } });
        } else {
            res.json({ success: false, message: `Không tìm thấy bàn ${tableId}` });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Root ──
app.get('/', (req, res) => {
    res.json({
        name: 'BACCARAT VIP — NO STREAK FIX v18.0',
        version: '18.0.0',
        author: '@tranhoang2286',
        features: [
            '✅ KHÔNG chạy theo cầu mù quáng',
            '✅ Phân tích tần suất thực tế từng cửa',
            '✅ Phát hiện cửa đang nguội (thiếu)',
            '✅ Phân tích zigzag (đảo chiều)',
            '✅ Phân tích pattern thực tế',
            '✅ Cân bằng B/P',
            '✅ Chỉ dự đoán khi confidence >= 58%',
            '✅ Chênh lệch tối thiểu 8%'
        ],
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all',
            'Lấy dữ liệu bàn': '/api/baccarat/:tableId'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('══════════════════════════════════════════════');
    console.log('🃏 BACCARAT VIP — NO STREAK FIX v18.0');
    console.log('══════════════════════════════════════════════');
    console.log(`🚀 http://localhost:${PORT}`);
    console.log('✅ KHÔNG chạy theo cầu mù quáng');
    console.log('✅ Phân tích tần suất thực tế');
    console.log('✅ Phát hiện cửa đang nguội');
    console.log('✅ Phân tích zigzag & pattern');
    console.log('✅ Cân bằng B/P');
    console.log(`👤 @tranhoang2286`);
    console.log('══════════════════════════════════════════════');
});
