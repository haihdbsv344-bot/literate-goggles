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
const learningData = {}; // Lưu lịch sử học cầu

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
// CƠ CHẾ HỌC CẦU TỰ ĐỘNG
// ============================================================

// Học pattern từ lịch sử
function learnPatterns(history) {
    const patterns = {};
    const arr = toArr(history);
    if (arr.length < 20) return patterns;
    
    // Học các pattern 3-5 ván
    for (let len = 3; len <= 5; len++) {
        for (let i = 0; i <= arr.length - len - 1; i++) {
            const pattern = arr.slice(i, i + len).join('');
            const next = arr[i + len];
            if (!patterns[pattern]) patterns[pattern] = {B:0, P:0, T:0, total:0};
            patterns[pattern][next]++;
            patterns[pattern].total++;
        }
    }
    return patterns;
}

// Học tần suất xuất hiện
function learnFrequency(history) {
    const arr = toArr(history);
    const cnt = {B:0, P:0, T:0};
    for (const c of arr) if (cnt[c] !== undefined) cnt[c]++;
    return {
        B: cnt.B / arr.length * 100,
        P: cnt.P / arr.length * 100,
        T: cnt.T / arr.length * 100
    };
}

// Học chu kỳ streak
function learnStreak(history) {
    const arr = toArr(history);
    const streaks = {B: [], P: [], T: []};
    let cur = {c: arr[0], n: 1};
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === cur.c) cur.n++;
        else {
            streaks[cur.c].push(cur.n);
            cur = {c: arr[i], n: 1};
        }
    }
    streaks[cur.c].push(cur.n);
    
    const result = {};
    for (const k of ['B', 'P', 'T']) {
        if (streaks[k].length > 0) {
            result[k] = {
                avg: mean(streaks[k]),
                max: Math.max(...streaks[k]),
                min: Math.min(...streaks[k]),
                count: streaks[k].length
            };
        }
    }
    return result;
}

// Học xác suất chuyển tiếp (Markov)
function learnMarkov(history) {
    const arr = toArr(history);
    const m = {
        B: {B:0, P:0, T:0},
        P: {B:0, P:0, T:0},
        T: {B:0, P:0, T:0}
    };
    for (let i = 0; i < arr.length - 1; i++) {
        if (m[arr[i]]) m[arr[i]][arr[i+1]]++;
    }
    const result = {};
    for (const from of ['B', 'P', 'T']) {
        const total = m[from].B + m[from].P + m[from].T;
        if (total > 0) {
            result[from] = {
                B: m[from].B / total,
                P: m[from].P / total,
                T: m[from].T / total
            };
        }
    }
    return result;
}

// Học cầu đang chạy
function learnCurrentTrend(history) {
    const arr = toArr(history);
    const recent = arr.slice(-10);
    const cnt = {B:0, P:0, T:0};
    for (const c of recent) if (cnt[c] !== undefined) cnt[c]++;
    
    // Xu hướng
    let trend = 'MIXED';
    if (cnt.B >= 7) trend = 'B_STRONG';
    else if (cnt.P >= 7) trend = 'P_STRONG';
    else if (cnt.T >= 4) trend = 'T_STRONG';
    else if (cnt.B >= 5 && cnt.P >= 5) trend = 'BALANCED';
    
    // Độ dài streak hiện tại
    let currentStreak = 1;
    if (arr.length > 1) {
        const last = arr[arr.length - 1];
        for (let i = arr.length - 2; i >= 0; i--) {
            if (arr[i] === last) currentStreak++;
            else break;
        }
    }
    
    return {
        trend,
        currentStreak,
        last: arr[arr.length - 1],
        recentB: cnt.B,
        recentP: cnt.P,
        recentT: cnt.T
    };
}

// Học độ lệch so với chuẩn
function learnDeviation(history) {
    const arr = toArr(history);
    const cnt = {B:0, P:0, T:0};
    for (const c of arr) if (cnt[c] !== undefined) cnt[c]++;
    const N = arr.length;
    
    const std = {B: 45.86, P: 44.62, T: 9.52};
    const real = {
        B: cnt.B / N * 100,
        P: cnt.P / N * 100,
        T: cnt.T / N * 100
    };
    
    return {
        B: real.B - std.B,
        P: real.P - std.P,
        T: real.T - std.T
    };
}

// ============================================================
// THUẬT TOÁN DỰ ĐOÁN CHÍNH - HỌC TỪ TẤT CẢ CẦU
// ============================================================
function predictWithLearning(history, tableId) {
    if (!history || history.length < 10) {
        return {
            recommend: 'Đợi đủ dữ liệu',
            rate: 0,
            confidence: 0,
            pattern: 'Chưa đủ dữ liệu',
            stats: {}
        };
    }
    
    const arr = toArr(history);
    
    // ── HỌC TỪ DỮ LIỆU ──
    const freq = learnFrequency(history);
    const patterns = learnPatterns(history);
    const streaks = learnStreak(history);
    const markov = learnMarkov(history);
    const trend = learnCurrentTrend(history);
    const deviation = learnDeviation(history);
    
    // ── LƯU LẠI ĐỂ HỌC TIẾP ──
    if (!learningData[tableId]) learningData[tableId] = [];
    learningData[tableId].push({
        time: Date.now(),
        history: history,
        result: arr[arr.length - 1]
    });
    if (learningData[tableId].length > 100) learningData[tableId].shift();
    
    // ── DỰ ĐOÁN DỰA TRÊN PATTERN ──
    let patternVote = {B:0.46, P:0.44, T:0.10};
    const last3 = arr.slice(-3).join('');
    const last4 = arr.slice(-4).join('');
    const last5 = arr.slice(-5).join('');
    
    // Tìm pattern khớp
    for (const len of [5, 4, 3]) {
        const key = arr.slice(-len).join('');
        if (patterns[key] && patterns[key].total >= 3) {
            const p = patterns[key];
            const total = p.total;
            patternVote = {
                B: p.B / total,
                P: p.P / total,
                T: p.T / total
            };
            break;
        }
    }
    
    // ── DỰ ĐOÁN DỰA TRÊN MARKOV ──
    const last = arr[arr.length - 1];
    let markovVote = {B:0.46, P:0.44, T:0.10};
    if (markov[last]) {
        markovVote = markov[last];
    }
    
    // ── DỰ ĐOÁN DỰA TRÊN DEVIATION ──
    let devVote = {B:0.46, P:0.44, T:0.10};
    if (deviation.B < -8) {
        devVote.B = 0.55;
        devVote.P = 0.35;
        devVote.T = 0.10;
    } else if (deviation.P < -8) {
        devVote.B = 0.35;
        devVote.P = 0.55;
        devVote.T = 0.10;
    } else if (deviation.T < -5) {
        devVote.T = 0.18;
        devVote.B = 0.42;
        devVote.P = 0.40;
    }
    
    // ── DỰ ĐOÁN DỰA TRÊN TREND ──
    let trendVote = {B:0.46, P:0.44, T:0.10};
    if (trend.trend === 'B_STRONG') {
        // Đang B mạnh -> khả năng P về để cân bằng
        trendVote.B = 0.40;
        trendVote.P = 0.50;
        trendVote.T = 0.10;
    } else if (trend.trend === 'P_STRONG') {
        trendVote.B = 0.50;
        trendVote.P = 0.40;
        trendVote.T = 0.10;
    } else if (trend.trend === 'T_STRONG') {
        trendVote.T = 0.15;
        trendVote.B = 0.43;
        trendVote.P = 0.42;
    }
    
    // ── DỰ ĐOÁN DỰA TRÊN STREAK ──
    let streakVote = {B:0.46, P:0.44, T:0.10};
    if (streaks[last]) {
        const avgStreak = streaks[last].avg || 2;
        const current = trend.currentStreak;
        if (current >= avgStreak * 1.5) {
            // Streak đã dài -> khả năng đảo chiều
            if (last === 'B') {
                streakVote.B = 0.35;
                streakVote.P = 0.55;
                streakVote.T = 0.10;
            } else if (last === 'P') {
                streakVote.B = 0.55;
                streakVote.P = 0.35;
                streakVote.T = 0.10;
            }
        } else {
            // Tiếp tục streak
            if (last === 'B') {
                streakVote.B = 0.52;
                streakVote.P = 0.38;
                streakVote.T = 0.10;
            } else if (last === 'P') {
                streakVote.B = 0.38;
                streakVote.P = 0.52;
                streakVote.T = 0.10;
            }
        }
    }
    
    // ── TỔNG HỢP CÓ TRỌNG SỐ ──
    const votes = [
        {vote: patternVote, weight: 2.0},
        {vote: markovVote, weight: 1.8},
        {vote: devVote, weight: 1.5},
        {vote: trendVote, weight: 1.6},
        {vote: streakVote, weight: 1.7},
        {vote: {B:0.4586, P:0.4462, T:0.0952}, weight: 0.8}
    ];
    
    let totalW = 0, sumB = 0, sumP = 0, sumT = 0;
    for (const v of votes) {
        sumB += v.vote.B * v.weight;
        sumP += v.vote.P * v.weight;
        sumT += v.vote.T * v.weight;
        totalW += v.weight;
    }
    
    let rB = sumB / totalW * 100;
    let rP = sumP / totalW * 100;
    let rT = sumT / totalW * 100;
    
    // ── NORMALIZE ──
    const rawSum = rB + rP + rT;
    rB = (rB / rawSum) * 100;
    rP = (rP / rawSum) * 100;
    rT = (rT / rawSum) * 100;
    
    // ── CONFIDENCE ──
    const avgOthersB = (rP + rT) / 2;
    const avgOthersP = (rB + rT) / 2;
    const avgOthersT = (rB + rP) / 2;
    
    let confB = 50 + (rB - avgOthersB) * 2.5;
    let confP = 50 + (rP - avgOthersP) * 2.5;
    let confT = 50 + (rT - avgOthersT) * 2.5;
    
    // Tăng confidence nếu có nhiều dữ liệu học
    const learningSize = Math.min(learningData[tableId]?.length || 0, 100);
    const boost = learningSize / 100 * 5;
    confB = clamp(confB + boost, 45, 92);
    confP = clamp(confP + boost, 45, 92);
    confT = clamp(confT + boost, 40, 85);
    
    // ── CHỌN DỰ ĐOÁN ──
    const sides = [
        {name: 'Banker', rate: Math.round(rB), conf: Math.round(confB)},
        {name: 'Player', rate: Math.round(rP), conf: Math.round(confP)},
        {name: 'Tie', rate: Math.round(rT), conf: Math.round(confT)}
    ];
    sides.sort((a,b) => b.conf - a.conf);
    const best = sides[0];
    
    // ── XÁC ĐỊNH PATTERN ──
    let pattern = 'Cầu đan xen';
    if (trend.trend === 'B_STRONG') pattern = '🔥 B đang mạnh (có thể đảo)';
    else if (trend.trend === 'P_STRONG') pattern = '🔥 P đang mạnh (có thể đảo)';
    else if (trend.trend === 'T_STRONG') pattern = '🔮 T đang xuất hiện nhiều';
    else if (trend.trend === 'BALANCED') pattern = '⚖️ B/P đang cân bằng';
    else if (Math.abs(deviation.B) > 10) pattern = `📊 B lệch ${Math.round(deviation.B)}% so chuẩn`;
    else if (Math.abs(deviation.P) > 10) pattern = `📊 P lệch ${Math.round(deviation.P)}% so chuẩn`;
    
    // Học từ các bàn khác
    if (Object.keys(learningData).length > 1) {
        // Học cross-table
        let crossB = 0, crossP = 0, crossT = 0, crossTotal = 0;
        for (const [id, data] of Object.entries(learningData)) {
            if (id === tableId) continue;
            const last10 = data.slice(-10);
            for (const d of last10) {
                if (d.result === 'B') crossB++;
                else if (d.result === 'P') crossP++;
                else crossT++;
                crossTotal++;
            }
        }
        if (crossTotal > 10) {
            const crossVote = {
                B: crossB / crossTotal * 100,
                P: crossP / crossTotal * 100,
                T: crossT / crossTotal * 100
            };
            // Kết hợp cross-vote
            rB = rB * 0.7 + crossVote.B * 0.3;
            rP = rP * 0.7 + crossVote.P * 0.3;
            rT = rT * 0.7 + crossVote.T * 0.3;
            const s = rB + rP + rT;
            rB = rB / s * 100;
            rP = rP / s * 100;
            rT = rT / s * 100;
            pattern += ` | Học từ ${Object.keys(learningData).length-1} bàn khác`;
        }
    }
    
    // ── LÀM TRÒN ──
    let b = Math.round(rB), p = Math.round(rP), t = Math.round(rT);
    const rs = b + p + t;
    if (rs !== 100) {
        const diff = 100 - rs;
        if (b >= p && b >= t) b += diff;
        else if (p >= b && p >= t) p += diff;
        else t += diff;
    }
    
    // Lưu lịch sử dự đoán
    if (!predHistory[tableId]) predHistory[tableId] = [];
    predHistory[tableId].push(best.name[0]);
    if (predHistory[tableId].length > 50) predHistory[tableId].shift();
    
    return {
        recommend: best.name,
        rate: best.rate,
        confidence: best.conf,
        pattern: pattern,
        banker: {rate: b, conf: Math.round(confB)},
        player: {rate: p, conf: Math.round(confP)},
        tie: {rate: t, conf: Math.round(confT)},
        stats: {
            freq: freq,
            deviation: deviation,
            trend: trend.trend,
            currentStreak: trend.currentStreak,
            learningSize: learningData[tableId]?.length || 0,
            crossTables: Object.keys(learningData).length - 1
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

        const r = predictWithLearning(cauGoc, tableId);

        res.json({
            phiên: sessionData[tableId],
            cầu_gốc: cauGoc,
            Dự_đoán: r.recommend,
            Tỉ_lệ: `${r.rate}%`,
            Độ_tin_cậy: `${r.confidence}%`,
            BANKER: `${r.banker.rate}% (${r.banker.conf}%)`,
            PLAYER: `${r.player.rate}% (${r.player.conf}%)`,
            TIE: `${r.tie.rate}% (${r.tie.conf}%)`,
            Cầu: r.pattern,
            đã_học: `${r.stats.learningSize} ván`,
            cross_learn: `${r.stats.crossTables} bàn khác`,
            trend: r.stats.trend,
            streak: `Streak ${r.stats.currentStreak}`,
            stats: {
                'Tần suất thực': `B=${Math.round(r.stats.freq.B)}% P=${Math.round(r.stats.freq.P)}% T=${Math.round(r.stats.freq.T)}%`,
                'Độ lệch chuẩn': `B=${Math.round(r.stats.deviation.B)}% P=${Math.round(r.stats.deviation.P)}% T=${Math.round(r.stats.deviation.T)}%`,
                'Xu hướng': r.stats.trend,
                'Streak hiện tại': r.stats.currentStreak
            }
        });
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

            const r = predictWithLearning(cauGoc, id);
            
            predictions[id] = {
                cầu_gốc: cauGoc,
                phiên: sessionData[id],
                Dự_đoán: r.recommend,
                Tỉ_lệ: `${r.rate}%`,
                Độ_tin_cậy: `${r.confidence}%`,
                BANKER: `${r.banker.rate}%`,
                PLAYER: `${r.player.rate}%`,
                TIE: `${r.tie.rate}%`,
                Cầu: r.pattern,
                đã_học: `${r.stats.learningSize} ván`
            };
        }

        res.json({
            success: true,
            engine: 'VIP-v20.0-LEARNING',
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

// ── API: Reset học ──
app.get('/api/reset/:tableId', (req, res) => {
    const tableId = req.params.tableId.toUpperCase();
    if (learningData[tableId]) {
        learningData[tableId] = [];
        res.json({ success: true, message: `Đã reset học cho bàn ${tableId}` });
    } else {
        res.json({ success: false, message: `Không tìm thấy bàn ${tableId}` });
    }
});

// ── Root ──
app.get('/', (req, res) => {
    res.json({
        name: 'BACCARAT VIP — LEARNING ENGINE v20.0',
        version: '20.0.0',
        author: '@tranhoang2286',
        features: [
            '✅ HỌC CẦU TỰ ĐỘNG từ lịch sử',
            '✅ HỌC PATTERN 3-5 ván',
            '✅ HỌC STREAK CHU KỲ',
            '✅ HỌC MARKOV CHAIN',
            '✅ HỌC CROSS-TABLE từ các bàn khác',
            '✅ DỰ ĐOÁN LUÔN không chờ',
            '✅ Càng chạy càng thông minh'
        ],
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all',
            'Lấy dữ liệu bàn': '/api/baccarat/:tableId',
            'Reset học': '/api/reset/:tableId'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('══════════════════════════════════════════════');
    console.log('🃏 BACCARAT VIP — LEARNING ENGINE v20.0');
    console.log('══════════════════════════════════════════════');
    console.log(`🚀 http://localhost:${PORT}`);
    console.log('✅ HỌC CẦU TỰ ĐỘNG');
    console.log('✅ HỌC PATTERN + STREAK + MARKOV');
    console.log('✅ HỌC CROSS-TABLE');
    console.log('✅ DỰ ĐOÁN LUÔN');
    console.log('✅ CÀNG CHẠY CÀNG THÔNG MINH');
    console.log(`👤 @tranhoang2286`);
    console.log('══════════════════════════════════════════════');
});
