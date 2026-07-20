const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

// ============================================================
// LƯU DỮ LIỆU
// ============================================================
const sessionData = {};
const lastData = {};
const historyCorrect = {};
const predictionHistory = {};
const streakHistory = {};
const patternHistory = {};

// ============================================================
// HÀM CHUYỂN STRING -> ARRAY
// ============================================================
function toArray(str) {
    return str ? str.split('') : [];
}

// ============================================================
// THUẬT TOÁN 1: PHÂN TÍCH TẦN SUẤT NÂNG CAO
// ============================================================
function advancedFrequencyAnalysis(arr) {
    const total = arr.length || 1;
    const counts = { B: 0, P: 0, T: 0 };
    for (const c of arr) {
        if (counts[c] !== undefined) counts[c]++;
    }
    
    // Xác suất có điều kiện
    const probs = {
        B: counts.B / total,
        P: counts.P / total,
        T: counts.T / total
    };
    
    // Điều chỉnh theo xác suất thực tế Baccarat
    const adjusted = {
        B: probs.B * 0.6 + 0.18344,
        P: probs.P * 0.6 + 0.17848,
        T: probs.T * 0.6 + 0.03808
    };
    
    // Chuẩn hóa
    const sum = adjusted.B + adjusted.P + adjusted.T;
    return {
        B: (adjusted.B / sum) * 100,
        P: (adjusted.P / sum) * 100,
        T: (adjusted.T / sum) * 100,
        counts: counts,
        total: total
    };
}

// ============================================================
// THUẬT TOÁN 2: PHÂN TÍCH STREAK (DÂY) NÂNG CAO
// ============================================================
function advancedStreakAnalysis(arr) {
    if (arr.length < 2) return { max: 1, char: 'B', all: [], avg: { B: 0, P: 0, T: 0 } };
    
    let current = 1;
    let max = 1;
    let maxChar = arr[0];
    const all = [];
    const streaks = { B: [], P: [], T: [] };
    
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === arr[i-1]) {
            current++;
            if (current > max) {
                max = current;
                maxChar = arr[i];
            }
        } else {
            if (current >= 2) {
                all.push({ char: arr[i-1], length: current });
                streaks[arr[i-1]].push(current);
            }
            current = 1;
        }
    }
    if (current >= 2) {
        all.push({ char: arr[arr.length-1], length: current });
        streaks[arr[arr.length-1]].push(current);
    }
    
    // Tính trung bình streak
    const avg = { B: 0, P: 0, T: 0 };
    for (const key of ['B', 'P', 'T']) {
        if (streaks[key].length > 0) {
            avg[key] = streaks[key].reduce((a, b) => a + b, 0) / streaks[key].length;
        }
    }
    
    // Xác suất streak tiếp tục
    const lastChar = arr[arr.length - 1];
    const lastStreak = streaks[lastChar].length > 0 ? streaks[lastChar][streaks[lastChar].length - 1] : 1;
    const continueProb = lastStreak / (avg[lastChar] || 1);
    
    return { max, char: maxChar, all, avg, lastStreak, continueProb: Math.min(continueProb, 1) };
}

// ============================================================
// THUẬT TOÁN 3: PHÂN TÍCH ZIGZAG NÂNG CAO
// ============================================================
function advancedZigzagAnalysis(arr) {
    if (arr.length < 3) return { count: 0, positions: [], patterns: [] };
    
    let count = 0;
    const positions = [];
    const patterns = [];
    for (let i = 1; i < arr.length - 1; i++) {
        if (arr[i] !== arr[i-1] && arr[i] !== arr[i+1]) {
            count++;
            positions.push(i);
            patterns.push({ pos: i, char: arr[i], prev: arr[i-1], next: arr[i+1] });
        }
    }
    return { count, positions, patterns };
}

// ============================================================
// THUẬT TOÁN 4: PHÂN TÍCH PATTERN 2-2 NÂNG CAO
// ============================================================
function advancedPattern22(arr) {
    if (arr.length < 4) return { count: 0, chars: [], positions: [] };
    
    let count = 0;
    const chars = [];
    const positions = [];
    for (let i = 1; i < arr.length - 2; i += 2) {
        if (arr[i] === arr[i-1] && arr[i+1] === arr[i+2]) {
            count++;
            chars.push(arr[i]);
            positions.push(i);
        }
    }
    return { count, chars, positions };
}

// ============================================================
// THUẬT TOÁN 5: PHÂN TÍCH PATTERN 3-3 NÂNG CAO
// ============================================================
function advancedPattern33(arr) {
    if (arr.length < 6) return { count: 0, chars: [], positions: [] };
    
    let count = 0;
    const chars = [];
    const positions = [];
    for (let i = 2; i < arr.length - 3; i += 3) {
        if (arr[i] === arr[i-1] && arr[i] === arr[i-2] &&
            arr[i+1] === arr[i+2] && arr[i+1] === arr[i+3]) {
            count++;
            chars.push(arr[i]);
            positions.push(i);
        }
    }
    return { count, chars, positions };
}

// ============================================================
// THUẬT TOÁN 6: PHÂN TÍCH PATTERN 4-4
// ============================================================
function advancedPattern44(arr) {
    if (arr.length < 8) return { count: 0 };
    
    let count = 0;
    for (let i = 3; i < arr.length - 4; i += 4) {
        if (arr[i] === arr[i-1] && arr[i] === arr[i-2] && arr[i] === arr[i-3] &&
            arr[i+1] === arr[i+2] && arr[i+1] === arr[i+3] && arr[i+1] === arr[i+4]) {
            count++;
        }
    }
    return { count };
}

// ============================================================
// THUẬT TOÁN 7: PHÂN TÍCH PATTERN 1-2-3
// ============================================================
function advancedPattern123(arr) {
    if (arr.length < 6) return { count: 0, positions: [] };
    
    let count = 0;
    const positions = [];
    for (let i = 0; i < arr.length - 6; i++) {
        if (arr[i] !== arr[i+1] &&
            arr[i+1] === arr[i+2] &&
            arr[i+2] !== arr[i+3] &&
            arr[i+3] === arr[i+4] &&
            arr[i+4] === arr[i+5]) {
            count++;
            positions.push(i);
        }
    }
    return { count, positions };
}

// ============================================================
// THUẬT TOÁN 8: PHÂN TÍCH PATTERN 2-1-2
// ============================================================
function advancedPattern212(arr) {
    if (arr.length < 5) return { count: 0, positions: [] };
    
    let count = 0;
    const positions = [];
    for (let i = 0; i < arr.length - 5; i++) {
        if (arr[i] === arr[i+1] &&
            arr[i+1] !== arr[i+2] &&
            arr[i+2] === arr[i+3] &&
            arr[i+3] === arr[i+4]) {
            count++;
            positions.push(i);
        }
    }
    return { count, positions };
}

// ============================================================
// THUẬT TOÁN 9: MARKOV BẬC 1 NÂNG CAO
// ============================================================
function advancedMarkov1(arr) {
    if (arr.length < 2) return { pred: 'B', prob: 0, matrix: null };
    
    const matrix = { 'B': { 'B': 0, 'P': 0, 'T': 0 }, 'P': { 'B': 0, 'P': 0, 'T': 0 }, 'T': { 'B': 0, 'P': 0, 'T': 0 } };
    for (let i = 0; i < arr.length - 1; i++) {
        if (matrix[arr[i]] && matrix[arr[i]][arr[i+1]] !== undefined) {
            matrix[arr[i]][arr[i+1]]++;
        }
    }
    
    const lastChar = arr[arr.length - 1];
    const trans = matrix[lastChar];
    let pred = 'B';
    let maxProb = 0;
    if (trans) {
        const total = trans.B + trans.P + trans.T;
        if (total > 0) {
            for (const [key, val] of Object.entries(trans)) {
                const prob = val / total;
                if (prob > maxProb) {
                    maxProb = prob;
                    pred = key;
                }
            }
        }
    }
    return { pred, prob: maxProb, matrix };
}

// ============================================================
// THUẬT TOÁN 10: MARKOV BẬC 2 NÂNG CAO
// ============================================================
function advancedMarkov2(arr) {
    if (arr.length < 3) return { pred: 'B', prob: 0, matrix: null };
    
    const matrix = {};
    for (let i = 0; i < arr.length - 2; i++) {
        const key = arr[i] + arr[i+1];
        const next = arr[i+2];
        if (!matrix[key]) matrix[key] = { 'B': 0, 'P': 0, 'T': 0 };
        if (matrix[key][next] !== undefined) matrix[key][next]++;
    }
    
    const lastKey = arr.slice(-2).join('');
    const trans = matrix[lastKey];
    let pred = 'B';
    let maxProb = 0;
    if (trans) {
        const total = trans.B + trans.P + trans.T;
        if (total > 0) {
            for (const [key, val] of Object.entries(trans)) {
                const prob = val / total;
                if (prob > maxProb) {
                    maxProb = prob;
                    pred = key;
                }
            }
        }
    }
    return { pred, prob: maxProb, matrix };
}

// ============================================================
// THUẬT TOÁN 11: PHÂN TÍCH MOMENTUM
// ============================================================
function advancedMomentum(arr) {
    if (arr.length < 2) return { value: 0, acc: 0, velocities: [] };
    
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    let momentum = 0;
    let acceleration = 0;
    const velocities = [];
    
    for (let i = 1; i < values.length; i++) {
        const v = values[i] - values[i-1];
        velocities.push(v);
        momentum += v;
        if (i > 1) {
            acceleration += v - velocities[velocities.length - 2];
        }
    }
    
    momentum = momentum / (values.length - 1);
    acceleration = acceleration / (values.length - 2 || 1);
    
    return { value: momentum, acc: acceleration, velocities };
}

// ============================================================
// THUẬT TOÁN 12: PHÂN TÍCH ENTROPY
// ============================================================
function advancedEntropy(arr) {
    if (arr.length < 3) return { value: 0, predictability: 0 };
    
    const counts = { B: 0, P: 0, T: 0 };
    for (const c of arr) {
        if (counts[c] !== undefined) counts[c]++;
    }
    const total = arr.length;
    
    let entropy = 0;
    for (const c of ['B', 'P', 'T']) {
        const prob = counts[c] / total;
        if (prob > 0) entropy -= prob * Math.log2(prob);
    }
    
    const maxEntropy = Math.log2(3);
    const predictability = 1 - (entropy / maxEntropy);
    
    return { value: entropy, predictability };
}

// ============================================================
// THUẬT TOÁN 13: PHÂN TÍCH GAP (KHOẢNG CÁCH)
// ============================================================
function advancedGap(arr) {
    if (arr.length < 3) return { pred: 'B', score: 0, gaps: null };
    
    const gaps = { 'B': [], 'P': [], 'T': [] };
    const lastPos = { 'B': -1, 'P': -1, 'T': -1 };
    
    for (let i = 0; i < arr.length; i++) {
        const char = arr[i];
        if (lastPos[char] !== -1) {
            gaps[char].push(i - lastPos[char] - 1);
        }
        lastPos[char] = i;
    }
    
    const avgGaps = {};
    const stdGaps = {};
    for (const key of ['B', 'P', 'T']) {
        if (gaps[key].length > 0) {
            avgGaps[key] = gaps[key].reduce((a, b) => a + b, 0) / gaps[key].length;
            const variance = gaps[key].reduce((a, b) => a + Math.pow(b - avgGaps[key], 2), 0) / gaps[key].length;
            stdGaps[key] = Math.sqrt(variance);
        } else {
            avgGaps[key] = 2;
            stdGaps[key] = 1;
        }
    }
    
    const currentGap = {};
    for (const key of ['B', 'P', 'T']) {
        currentGap[key] = arr.length - 1 - lastPos[key];
    }
    
    let pred = 'B';
    let maxScore = 0;
    for (const key of ['B', 'P', 'T']) {
        const zScore = (currentGap[key] - avgGaps[key]) / (stdGaps[key] || 1);
        const score = Math.abs(zScore);
        if (score > maxScore) {
            maxScore = score;
            pred = key;
        }
    }
    
    return { pred, score: maxScore, gaps, avgGaps, currentGap };
}

// ============================================================
// THUẬT TOÁN 14: FIBONACCI
// ============================================================
function advancedFibonacci(arr) {
    if (arr.length < 3) return { pred: 'B', count: 0, positions: [] };
    
    const fib = [1, 1, 2, 3, 5, 8, 13, 21];
    const positions = [];
    for (const f of fib) {
        if (f <= arr.length) {
            positions.push(arr.length - f);
        }
    }
    
    const counts = { 'B': 0, 'P': 0, 'T': 0 };
    for (const pos of positions) {
        if (pos >= 0 && pos < arr.length) {
            const char = arr[pos];
            if (counts[char] !== undefined) counts[char]++;
        }
    }
    
    let pred = 'B';
    let maxCount = 0;
    for (const [key, val] of Object.entries(counts)) {
        if (val > maxCount) {
            maxCount = val;
            pred = key;
        }
    }
    
    return { pred, count: maxCount, positions, counts };
}

// ============================================================
// THUẬT TOÁN 15: HARMONIC
// ============================================================
function advancedHarmonic(arr) {
    if (arr.length < 4) return { count: 0, positions: [] };
    
    let count = 0;
    const positions = [];
    for (let i = 0; i < arr.length - 3; i++) {
        if (arr[i] !== arr[i+1] && arr[i+1] !== arr[i+2] && arr[i+2] !== arr[i+3]) {
            count++;
            positions.push(i);
        }
    }
    return { count, positions };
}

// ============================================================
// THUẬT TOÁN 16: CORRELATION
// ============================================================
function advancedCorrelation(arr) {
    if (arr.length < 5) return { pred: 'B', corr: [], acf: [] };
    
    const seq = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    const n = seq.length;
    const mean = seq.reduce((a, b) => a + b, 0) / n;
    const variance = seq.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    
    const corr = [];
    const acf = [];
    for (let lag = 1; lag <= Math.min(5, n - 1); lag++) {
        let sum = 0;
        for (let i = 0; i < n - lag; i++) {
            sum += (seq[i] - mean) * (seq[i + lag] - mean);
        }
        corr.push(sum / ((n - lag) * variance));
        acf.push(sum / ((n - lag) * n));
    }
    
    const lastValue = seq[n - 1];
    let pred = 'B';
    if (corr.length > 0 && corr[0] > 0.3) {
        pred = lastValue > 0 ? 'B' : 'P';
    } else if (corr.length > 1 && corr[1] < -0.3) {
        pred = lastValue > 0 ? 'P' : 'B';
    }
    
    return { pred, corr, acf };
}

// ============================================================
// THUẬT TOÁN 17: SUPPORT & RESISTANCE
// ============================================================
function advancedSupportResistance(arr) {
    if (arr.length < 5) return { supports: 0, resistances: 0, supportValues: [], resistanceValues: [] };
    
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    const supports = [];
    const resistances = [];
    
    for (let i = 2; i < values.length - 2; i++) {
        if (values[i] < values[i-1] && values[i] < values[i-2] &&
            values[i] < values[i+1] && values[i] < values[i+2]) {
            supports.push({ index: i, value: values[i] });
        }
        if (values[i] > values[i-1] && values[i] > values[i-2] &&
            values[i] > values[i+1] && values[i] > values[i+2]) {
            resistances.push({ index: i, value: values[i] });
        }
    }
    
    return { 
        supports: supports.length, 
        resistances: resistances.length,
        supportValues: supports,
        resistanceValues: resistances
    };
}

// ============================================================
// THUẬT TOÁN 18: PIVOT POINTS
// ============================================================
function advancedPivot(arr) {
    if (arr.length < 3) return { pivot: 0, r1: 0, s1: 0, r2: 0, s2: 0 };
    
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    const high = Math.max(...values);
    const low = Math.min(...values);
    const close = values[values.length - 1];
    
    const pivot = (high + low + close) / 3;
    const r1 = 2 * pivot - low;
    const s1 = 2 * pivot - high;
    const r2 = pivot + (high - low);
    const s2 = pivot - (high - low);
    
    return { pivot, r1, s1, r2, s2, high, low, close };
}

// ============================================================
// THUẬT TOÁN 19: TRENDLINE
// ============================================================
function advancedTrendline(arr) {
    if (arr.length < 5) return { slope: 0, intercept: 0, rSquared: 0, nextValue: 0 };
    
    const values = arr.map((c, i) => ({ x: i, y: c === 'B' ? 1 : c === 'P' ? -1 : 0 }));
    const n = values.length;
    
    const sumX = values.reduce((a, b) => a + b.x, 0);
    const sumY = values.reduce((a, b) => a + b.y, 0);
    const sumXY = values.reduce((a, b) => a + b.x * b.y, 0);
    const sumX2 = values.reduce((a, b) => a + b.x * b.x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const meanY = sumY / n;
    let ssTotal = 0;
    let ssResidual = 0;
    for (const v of values) {
        const predicted = slope * v.x + intercept;
        ssTotal += Math.pow(v.y - meanY, 2);
        ssResidual += Math.pow(v.y - predicted, 2);
    }
    const rSquared = 1 - (ssResidual / (ssTotal || 1));
    
    return { 
        slope, 
        intercept, 
        rSquared, 
        nextValue: slope * n + intercept,
        trend: slope > 0.1 ? 'UP' : slope < -0.1 ? 'DOWN' : 'SIDEWAYS'
    };
}

// ============================================================
// THUẬT TOÁN 20: VOLATILITY
// ============================================================
function advancedVolatility(arr) {
    if (arr.length < 3) return { value: 0, recent: 0, change: 0 };
    
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    const changes = [];
    for (let i = 1; i < values.length; i++) {
        changes.push(Math.abs(values[i] - values[i-1]));
    }
    
    const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
    const recent = changes.slice(-5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
    
    return { 
        value: avg, 
        recent: recentAvg,
        change: recentAvg - avg,
        isIncreasing: recentAvg > avg * 1.1
    };
}

// ============================================================
// THUẬT TOÁN 21: PATTERN RECOGNITION
// ============================================================
function advancedPatternRecognition(arr) {
    if (arr.length < 4) return { patterns: [], topPattern: null };
    
    const patternMap = {};
    for (let len = 2; len <= 5; len++) {
        for (let i = 0; i < arr.length - len; i++) {
            const p = arr.slice(i, i + len).join('');
            if (!patternMap[p]) patternMap[p] = 0;
            patternMap[p]++;
        }
    }
    
    const patterns = Object.entries(patternMap)
        .filter(([p, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([p, count]) => ({ pattern: p, count }));
    
    return { 
        patterns,
        topPattern: patterns.length > 0 ? patterns[0] : null
    };
}

// ============================================================
// THUẬT TOÁN 22: PHÂN TÍCH XU HƯỚNG (TREND ANALYSIS)
// ============================================================
function advancedTrendAnalysis(arr) {
    if (arr.length < 10) return { trend: 'NEUTRAL', strength: 0, direction: 0 };
    
    const window = Math.min(20, arr.length);
    const recent = arr.slice(-window);
    const values = recent.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const diff = avg2 - avg1;
    const strength = Math.abs(diff);
    
    let trend = 'NEUTRAL';
    if (diff > 0.2) trend = 'UP';
    else if (diff < -0.2) trend = 'DOWN';
    
    return { trend, strength, direction: diff };
}

// ============================================================
// THUẬT TOÁN 23: PHÂN TÍCH TIE CHUYÊN SÂU
// ============================================================
function advancedTieAnalysis(arr) {
    if (arr.length < 5) return { rate: 0, signal: false, score: 0, gap: 0 };
    
    const tiePositions = [];
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === 'T') tiePositions.push(i);
    }
    
    let rate = (tiePositions.length / arr.length) * 100;
    let gap = Infinity;
    let signal = false;
    let score = 0;
    
    if (tiePositions.length > 1) {
        let totalGap = 0;
        for (let i = 1; i < tiePositions.length; i++) {
            totalGap += tiePositions[i] - tiePositions[i-1];
        }
        gap = totalGap / (tiePositions.length - 1);
        
        const lastTiePos = tiePositions[tiePositions.length - 1];
        const currentGap = arr.length - 1 - lastTiePos;
        
        if (currentGap >= gap * 0.8) {
            signal = true;
            score += 40;
        }
    }
    
    // Tần suất Tie trong 20 ván gần nhất
    const recentWindow = Math.min(20, arr.length);
    const recentArr = arr.slice(-recentWindow);
    const recentTies = recentArr.filter(c => c === 'T').length;
    if (recentTies >= 2) {
        signal = true;
        score += 35;
    }
    
    // Pattern 2-2 không có Tie
    if (recentTies === 0) {
        let pattern22 = 0;
        for (let i = 1; i < Math.min(10, arr.length - 1); i += 2) {
            if (arr[arr.length - i] === arr[arr.length - i - 1]) {
                pattern22++;
            }
        }
        if (pattern22 >= 2) {
            signal = true;
            score += 25;
        }
    }
    
    // Điều chỉnh rate
    rate = rate * 0.3 + 9.52 * 0.2;
    if (signal) {
        rate += score * 0.15;
    }
    rate = Math.min(Math.max(rate, 3), 45);
    
    return { 
        rate: Math.round(rate), 
        signal, 
        score, 
        gap: Math.round(gap),
        positions: tiePositions,
        frequency: Math.round((tiePositions.length / arr.length) * 100)
    };
}

// ============================================================
// TỔNG HỢP THUẬT TOÁN - KHÔNG RANDOM - CỰC MẠNH
// ============================================================
function predictBCR(history) {
    if (!history || history.length < 3) {
        return {
            prediction: 'Player',
            bankerRate: 48,
            playerRate: 48,
            tieRate: 4,
            pattern: 'Chưa đủ dữ liệu',
            cau_goc: history || '',
            confidence: 50,
            stats: { B: 0, P: 0, T: 0 },
            algorithms: {}
        };
    }

    const arr = toArray(history);
    
    // ===== CHẠY TẤT CẢ THUẬT TOÁN =====
    const freq = advancedFrequencyAnalysis(arr);
    const streak = advancedStreakAnalysis(arr);
    const zigzag = advancedZigzagAnalysis(arr);
    const pattern22 = advancedPattern22(arr);
    const pattern33 = advancedPattern33(arr);
    const pattern44 = advancedPattern44(arr);
    const pattern123 = advancedPattern123(arr);
    const pattern212 = advancedPattern212(arr);
    const markov1 = advancedMarkov1(arr);
    const markov2 = advancedMarkov2(arr);
    const momentum = advancedMomentum(arr);
    const entropy = advancedEntropy(arr);
    const gap = advancedGap(arr);
    const fibonacci = advancedFibonacci(arr);
    const harmonic = advancedHarmonic(arr);
    const correlation = advancedCorrelation(arr);
    const support = advancedSupportResistance(arr);
    const pivot = advancedPivot(arr);
    const trendline = advancedTrendline(arr);
    const volatility = advancedVolatility(arr);
    const patterns = advancedPatternRecognition(arr);
    const trend = advancedTrendAnalysis(arr);
    const tie = advancedTieAnalysis(arr);

    // ============================================================
    // TÍNH ĐIỂM TỔNG HỢP
    // ============================================================
    let bankerScore = 0;
    let playerScore = 0;
    let tieScore = 0;

    // Trọng số cho 23 thuật toán
    const weights = {
        frequency: 0.08,
        streak: 0.07,
        zigzag: 0.06,
        pattern22: 0.05,
        pattern33: 0.04,
        pattern44: 0.03,
        pattern123: 0.03,
        pattern212: 0.03,
        markov1: 0.06,
        markov2: 0.05,
        momentum: 0.05,
        entropy: 0.04,
        gap: 0.04,
        fibonacci: 0.04,
        harmonic: 0.03,
        correlation: 0.04,
        support: 0.03,
        pivot: 0.03,
        trendline: 0.04,
        volatility: 0.03,
        patterns: 0.04,
        trend: 0.04,
        tie: 0.05
    };

    // 1. Frequency
    bankerScore += freq.B * weights.frequency;
    playerScore += freq.P * weights.frequency;
    tieScore += freq.T * weights.frequency;

    // 2. Streak
    if (streak.max >= 4) {
        const reverse = streak.char === 'B' ? 'P' : streak.char === 'P' ? 'B' : 'T';
        if (reverse === 'B') bankerScore += 100 * weights.streak;
        else if (reverse === 'P') playerScore += 100 * weights.streak;
        else tieScore += 100 * weights.streak;
    } else if (streak.max >= 2) {
        if (streak.char === 'B') bankerScore += 80 * weights.streak;
        else if (streak.char === 'P') playerScore += 80 * weights.streak;
        else tieScore += 80 * weights.streak;
    } else {
        bankerScore += 50 * weights.streak;
        playerScore += 50 * weights.streak;
        tieScore += 20 * weights.streak;
    }

    // 3. Zigzag
    if (zigzag.count >= 4) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 100 * weights.zigzag;
        else if (last === 'B') playerScore += 100 * weights.zigzag;
        else tieScore += 100 * weights.zigzag;
    } else if (zigzag.count >= 2) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 70 * weights.zigzag;
        else if (last === 'B') playerScore += 70 * weights.zigzag;
        else tieScore += 70 * weights.zigzag;
    } else {
        bankerScore += 50 * weights.zigzag;
        playerScore += 50 * weights.zigzag;
        tieScore += 20 * weights.zigzag;
    }

    // 4. Pattern 2-2
    if (pattern22.count >= 2) {
        const reverse = pattern22.chars[0] === 'B' ? 'P' : 'B';
        if (reverse === 'B') bankerScore += 100 * weights.pattern22;
        else playerScore += 100 * weights.pattern22;
    } else if (pattern22.count >= 1) {
        const last = arr[arr.length - 1];
        if (last === 'B') bankerScore += 70 * weights.pattern22;
        else if (last === 'P') playerScore += 70 * weights.pattern22;
        else tieScore += 70 * weights.pattern22;
    } else {
        bankerScore += 50 * weights.pattern22;
        playerScore += 50 * weights.pattern22;
    }

    // 5. Pattern 3-3
    if (pattern33.count >= 1) {
        const reverse = pattern33.chars[0] === 'B' ? 'P' : 'B';
        if (reverse === 'B') bankerScore += 100 * weights.pattern33;
        else playerScore += 100 * weights.pattern33;
    } else {
        bankerScore += 50 * weights.pattern33;
        playerScore += 50 * weights.pattern33;
    }

    // 6. Pattern 4-4
    if (pattern44.count >= 1) {
        const last = arr[arr.length - 1];
        if (last === 'B') playerScore += 100 * weights.pattern44;
        else if (last === 'P') bankerScore += 100 * weights.pattern44;
        else tieScore += 100 * weights.pattern44;
    }

    // 7. Pattern 1-2-3
    if (pattern123.count >= 1) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 100 * weights.pattern123;
        else if (last === 'B') playerScore += 100 * weights.pattern123;
        else tieScore += 100 * weights.pattern123;
    }

    // 8. Pattern 2-1-2
    if (pattern212.count >= 1) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 100 * weights.pattern212;
        else if (last === 'B') playerScore += 100 * weights.pattern212;
        else tieScore += 100 * weights.pattern212;
    }

    // 9. Markov 1
    if (markov1.prob > 0.4) {
        if (markov1.pred === 'B') bankerScore += 100 * weights.markov1;
        else if (markov1.pred === 'P') playerScore += 100 * weights.markov1;
        else tieScore += 100 * weights.markov1;
    } else {
        bankerScore += 50 * weights.markov1;
        playerScore += 50 * weights.markov1;
        tieScore += 20 * weights.markov1;
    }

    // 10. Markov 2
    if (markov2.prob > 0.4) {
        if (markov2.pred === 'B') bankerScore += 100 * weights.markov2;
        else if (markov2.pred === 'P') playerScore += 100 * weights.markov2;
        else tieScore += 100 * weights.markov2;
    } else {
        bankerScore += 50 * weights.markov2;
        playerScore += 50 * weights.markov2;
        tieScore += 20 * weights.markov2;
    }

    // 11. Momentum
    if (Math.abs(momentum.value) > 0.3) {
        if (momentum.value > 0) bankerScore += 100 * weights.momentum;
        else playerScore += 100 * weights.momentum;
    } else {
        bankerScore += 50 * weights.momentum;
        playerScore += 50 * weights.momentum;
    }

    // 12. Entropy
    if (entropy.predictability > 0.6) {
        const freqPred = freq.B > freq.P ? 'B' : 'P';
        if (freqPred === 'B') bankerScore += 100 * weights.entropy;
        else playerScore += 100 * weights.entropy;
    } else if (entropy.predictability < 0.3) {
        tieScore += 100 * weights.entropy;
    } else {
        bankerScore += 50 * weights.entropy;
        playerScore += 50 * weights.entropy;
    }

    // 13. Gap
    if (gap.score > 1.5) {
        if (gap.pred === 'B') bankerScore += 100 * weights.gap;
        else if (gap.pred === 'P') playerScore += 100 * weights.gap;
        else tieScore += 100 * weights.gap;
    } else {
        bankerScore += 50 * weights.gap;
        playerScore += 50 * weights.gap;
    }

    // 14. Fibonacci
    if (fibonacci.count >= 2) {
        if (fibonacci.pred === 'B') bankerScore += 100 * weights.fibonacci;
        else if (fibonacci.pred === 'P') playerScore += 100 * weights.fibonacci;
        else tieScore += 100 * weights.fibonacci;
    } else {
        bankerScore += 50 * weights.fibonacci;
        playerScore += 50 * weights.fibonacci;
    }

    // 15. Harmonic
    if (harmonic.count >= 4) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 100 * weights.harmonic;
        else if (last === 'B') playerScore += 100 * weights.harmonic;
        else tieScore += 100 * weights.harmonic;
    } else {
        bankerScore += 50 * weights.harmonic;
        playerScore += 50 * weights.harmonic;
    }

    // 16. Correlation
    if (correlation.pred === 'B') bankerScore += 100 * weights.correlation;
    else if (correlation.pred === 'P') playerScore += 100 * weights.correlation;
    else tieScore += 100 * weights.correlation;

    // 17. Support & Resistance
    if (support.supports > support.resistances + 2) {
        bankerScore += 100 * weights.support;
    } else if (support.resistances > support.supports + 2) {
        playerScore += 100 * weights.support;
    } else {
        bankerScore += 50 * weights.support;
        playerScore += 50 * weights.support;
    }

    // 18. Pivot
    if (pivot.pivot !== 0) {
        const lastValue = arr[arr.length - 1] === 'B' ? 1 : arr[arr.length - 1] === 'P' ? -1 : 0;
        if (lastValue > pivot.pivot) bankerScore += 100 * weights.pivot;
        else if (lastValue < pivot.pivot) playerScore += 100 * weights.pivot;
        else tieScore += 100 * weights.pivot;
    }

    // 19. Trendline
    if (trendline.rSquared > 0.3) {
        if (trendline.nextValue > 0.2) bankerScore += 100 * weights.trendline;
        else if (trendline.nextValue < -0.2) playerScore += 100 * weights.trendline;
        else tieScore += 100 * weights.trendline;
    } else {
        bankerScore += 50 * weights.trendline;
        playerScore += 50 * weights.trendline;
    }

    // 20. Volatility
    if (volatility.recent < volatility.value * 0.7) {
        const last = arr[arr.length - 1];
        if (last === 'B') bankerScore += 100 * weights.volatility;
        else if (last === 'P') playerScore += 100 * weights.volatility;
        else tieScore += 100 * weights.volatility;
    } else {
        bankerScore += 50 * weights.volatility;
        playerScore += 50 * weights.volatility;
    }

    // 21. Pattern Recognition
    if (patterns.topPattern) {
        const nextChar = patterns.topPattern.pattern[patterns.topPattern.pattern.length - 1];
        if (nextChar === 'B') bankerScore += 100 * weights.patterns;
        else if (nextChar === 'P') playerScore += 100 * weights.patterns;
        else tieScore += 100 * weights.patterns;
    } else {
        bankerScore += 50 * weights.patterns;
        playerScore += 50 * weights.patterns;
    }

    // 22. Trend
    if (trend.trend === 'UP') bankerScore += 100 * weights.trend;
    else if (trend.trend === 'DOWN') playerScore += 100 * weights.trend;
    else {
        bankerScore += 50 * weights.trend;
        playerScore += 50 * weights.trend;
    }

    // 23. Tie Analysis
    if (tie.signal && tie.rate > 20) {
        tieScore += tie.rate * weights.tie * 2;
    } else {
        tieScore += tie.rate * weights.tie;
    }

    // ============================================================
    // CHUẨN HÓA VÀ TÍNH TỈ LỆ
    // ============================================================
    const totalScore = bankerScore + playerScore + tieScore || 1;
    let bankerRate = (bankerScore / totalScore) * 100;
    let playerRate = (playerScore / totalScore) * 100;
    let tieRate = (tieScore / totalScore) * 100;

    // Điều chỉnh theo xác suất thực tế
    bankerRate = bankerRate * 0.7 + 13.76;
    playerRate = playerRate * 0.7 + 13.39;
    tieRate = tieRate * 0.7 + 2.86;

    const sum = bankerRate + playerRate + tieRate;
    bankerRate = (bankerRate / sum) * 100;
    playerRate = (playerRate / sum) * 100;
    tieRate = (tieRate / sum) * 100;

    // ============================================================
    // XÁC ĐỊNH DỰ ĐOÁN
    // ============================================================
    let prediction = 'Player';
    let maxRate = Math.max(bankerRate, playerRate, tieRate);
    if (maxRate === bankerRate) prediction = 'Banker';
    else if (maxRate === playerRate) prediction = 'Player';
    else prediction = 'Tie';

    // ============================================================
    // LÀM TRÒN TỈ LỆ
    // ============================================================
    let b = Math.round(bankerRate);
    let p = Math.round(playerRate);
    let t = Math.round(tieRate);

    // Đảm bảo không có tỉ lệ nào = 50%
    if (b === 50) b = 51;
    if (p === 50) p = 49;
    if (t === 50) t = 6;

    // Đảm bảo tổng = 100%
    const totalRates = b + p + t;
    if (totalRates !== 100) {
        const diff = 100 - totalRates;
        if (b > p && b > t) b += diff;
        else if (p > b && p > t) p += diff;
        else t += diff;
    }

    // ============================================================
    // ĐỘ TIN CẬY
    // ============================================================
    let confidence = Math.round(Math.max(b, p, t));
    if (tie.signal && t > 25) {
        confidence = Math.min(confidence + 5, 95);
    }
    confidence = Math.max(55, Math.min(confidence, 95));

    // ============================================================
    // PHÂN TÍCH CẦU
    // ============================================================
    let patternDesc = 'Cầu đan xen';
    if (prediction === 'Tie' && tie.signal) {
        patternDesc = `🔮 TIE SIGNAL! Cách ${tie.gap} ván, Tần suất ${tie.frequency}%`;
    } else if (streak.max >= 4) {
        patternDesc = `Dây ${streak.char} x${streak.max} - Sắp đảo chiều`;
    } else if (zigzag.count >= 4) {
        patternDesc = `Zigzag ${zigzag.count} lần`;
    } else if (pattern22.count >= 2 && pattern33.count >= 1) {
        patternDesc = `Cầu 2-2 (${pattern22.count}) + 3-3 (${pattern33.count})`;
    } else if (pattern22.count >= 2) {
        patternDesc = `Cầu 2-2 (${pattern22.count} lần)`;
    } else if (pattern33.count >= 1) {
        patternDesc = `Cầu 3-3`;
    } else if (pattern44.count >= 1) {
        patternDesc = `Cầu 4-4`;
    } else if (freq.B > 55) {
        patternDesc = `Banker áp đảo ${Math.round(freq.B)}%`;
    } else if (freq.P > 55) {
        patternDesc = `Player áp đảo ${Math.round(freq.P)}%`;
    } else if (freq.T > 10) {
        patternDesc = `Tie xuất hiện nhiều ${Math.round(freq.T)}%`;
    } else if (trend.trend === 'UP') {
        patternDesc = `Xu hướng Banker (${Math.round(trend.strength * 100)}%)`;
    } else if (trend.trend === 'DOWN') {
        patternDesc = `Xu hướng Player (${Math.round(trend.strength * 100)}%)`;
    }

    // ============================================================
    // LƯU LỊCH SỬ THUẬT TOÁN
    // ============================================================
    const algorithms = {
        frequency: { B: Math.round(freq.B), P: Math.round(freq.P), T: Math.round(freq.T) },
        streak: { char: streak.char, max: streak.max },
        zigzag: { count: zigzag.count },
        pattern22: { count: pattern22.count },
        pattern33: { count: pattern33.count },
        pattern44: { count: pattern44.count },
        markov1: { pred: markov1.pred, prob: Math.round(markov1.prob * 100) },
        markov2: { pred: markov2.pred, prob: Math.round(markov2.prob * 100) },
        momentum: { value: Math.round(momentum.value * 100) / 100 },
        entropy: { value: Math.round(entropy.value * 10) / 10, predictability: Math.round(entropy.predictability * 100) },
        gap: { pred: gap.pred, score: Math.round(gap.score * 100) / 100 },
        fibonacci: { pred: fibonacci.pred, count: fibonacci.count },
        harmonic: { count: harmonic.count },
        correlation: { pred: correlation.pred },
        support: { supports: support.supports, resistances: support.resistances },
        trendline: { slope: Math.round(trendline.slope * 100) / 100, rSquared: Math.round(trendline.rSquared * 100) },
        volatility: { value: Math.round(volatility.value * 100) / 100 },
        trend: { trend: trend.trend, strength: Math.round(trend.strength * 100) },
        tie: { rate: tie.rate, signal: tie.signal, gap: tie.gap }
    };

    return {
        prediction: prediction,
        bankerRate: Math.max(b, 3),
        playerRate: Math.max(p, 3),
        tieRate: Math.max(t, 2),
        pattern: patternDesc,
        cau_goc: history,
        confidence: confidence,
        tie_signal: tie.signal,
        tie_score: tie.score,
        stats: {
            B: Math.round(freq.B),
            P: Math.round(freq.P),
            T: Math.round(freq.T),
            maxStreak: streak.max,
            zigzag: zigzag.count,
            pattern22: pattern22.count,
            pattern33: pattern33.count,
            pattern44: pattern44.count,
            tieGap: tie.gap,
            tieFrequency: tie.frequency,
            trend: trend.trend,
            momentum: Math.round(momentum.value * 100) / 100,
            entropy: Math.round(entropy.value * 10) / 10,
            predictability: Math.round(entropy.predictability * 100)
        },
        algorithms: algorithms
    };
}

// ============================================================
// LẤY DỮ LIỆU TỪ API
// ============================================================
async function fetchTableData(tableId) {
    try {
        const url = `https://literate-goggles-l1e3.onrender.com/api/predict/${tableId}`;
        const response = await axios.get(url, { timeout: 10000 });
        if (response.data && response.data.success) {
            return response.data;
        }
        return null;
    } catch (error) {
        console.error(`Lỗi bàn ${tableId}:`, error.message);
        return null;
    }
}

// ============================================================
// API DỰ ĐOÁN TỪNG BÀN
// ============================================================
app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId;
        const apiData = await fetchTableData(tableId);

        if (!apiData) {
            return res.json({
                success: false,
                message: `Không tìm thấy bàn ${tableId}`
            });
        }

        const cauGoc = apiData.cầu_gốc || apiData.cau_goc || '';
        const oldData = lastData[tableId] || '';
        const isNewData = (cauGoc !== oldData && cauGoc.length > oldData.length);
        lastData[tableId] = cauGoc;

        if (!sessionData[tableId]) sessionData[tableId] = 0;
        if (isNewData) sessionData[tableId]++;

        const result = predictBCR(cauGoc);

        // Tính đúng/sai
        let correct = 0;
        let wrong = 0;
        if (cauGoc.length > 1) {
            const lastActual = cauGoc[cauGoc.length - 1];
            const predMap = { 'Banker': 'B', 'Player': 'P', 'Tie': 'T' };
            if (predMap[result.prediction] === lastActual) {
                correct = 1;
                if (!historyCorrect[tableId]) historyCorrect[tableId] = { correct: 0, wrong: 0 };
                historyCorrect[tableId].correct++;
            } else {
                wrong = 1;
                if (!historyCorrect[tableId]) historyCorrect[tableId] = { correct: 0, wrong: 0 };
                historyCorrect[tableId].wrong++;
            }
        }

        const totalGames = historyCorrect[tableId] ? historyCorrect[tableId].correct + historyCorrect[tableId].wrong : 0;
        const winRate = totalGames > 0 ? Math.round((historyCorrect[tableId].correct / totalGames) * 100) : 0;

        if (!predictionHistory[tableId]) predictionHistory[tableId] = [];
        predictionHistory[tableId].push({
            session: sessionData[tableId],
            prediction: result.prediction,
            bankerRate: `${result.bankerRate}%`,
            playerRate: `${result.playerRate}%`,
            tieRate: `${result.tieRate}%`,
            result: correct === 1 ? 'Đúng' : 'Sai'
        });

        // Định dạng JSON response
        const responseData = {
            success: true,
            bàn: `Bàn ${tableId}`,
            phiên: sessionData[tableId],
            cầu_gốc: cauGoc,
            dự_đoán: result.prediction,
            Banker: `${result.bankerRate}%`,
            Player: `${result.playerRate}%`,
            Tie: `${result.tieRate}%`,
            tỉ_lệ: `${Math.max(result.bankerRate, result.playerRate, result.tieRate)}%`,
            đúng: historyCorrect[tableId] ? historyCorrect[tableId].correct : 0,
            sai: historyCorrect[tableId] ? historyCorrect[tableId].wrong : 0,
            tỉ_lệ_thắng_bàn: `${winRate}%`,
            cầu: result.pattern,
            confidence: `${result.confidence}%`,
            tie_signal: result.tie_signal,
            tie_score: result.tie_score,
            stats: result.stats,
            algorithms: result.algorithms,
            history: predictionHistory[tableId].slice(-20),
            id: '@tranhoang2286'
        };

        res.json(responseData);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// API DỰ ĐOÁN TẤT CẢ BÀN
// ============================================================
app.get('/api/predict/all', async (req, res) => {
    try {
        const tableIds = ['C01', 'C02', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C15', 'C16', 'C17', 'C18', 'C19', 'C20'];
        const results = [];

        for (const id of tableIds) {
            const apiData = await fetchTableData(id);
            if (apiData) {
                const cauGoc = apiData.cầu_gốc || apiData.cau_goc || '';
                const oldData = lastData[id] || '';
                const isNewData = (cauGoc !== oldData && cauGoc.length > oldData.length);
                lastData[id] = cauGoc;

                if (!sessionData[id]) sessionData[id] = 0;
                if (isNewData) sessionData[id]++;

                const result = predictBCR(cauGoc);

                let correct = 0;
                let wrong = 0;
                if (cauGoc.length > 1) {
                    const lastActual = cauGoc[cauGoc.length - 1];
                    const predMap = { 'Banker': 'B', 'Player': 'P', 'Tie': 'T' };
                    if (predMap[result.prediction] === lastActual) {
                        correct = 1;
                        if (!historyCorrect[id]) historyCorrect[id] = { correct: 0, wrong: 0 };
                        historyCorrect[id].correct++;
                    } else {
                        wrong = 1;
                        if (!historyCorrect[id]) historyCorrect[id] = { correct: 0, wrong: 0 };
                        historyCorrect[id].wrong++;
                    }
                }

                const totalGames = historyCorrect[id] ? historyCorrect[id].correct + historyCorrect[id].wrong : 0;
                const winRate = totalGames > 0 ? Math.round((historyCorrect[id].correct / totalGames) * 100) : 0;

                results.push({
                    bàn: `Bàn ${id}`,
                    phiên: sessionData[id],
                    dự_đoán: result.prediction,
                    Banker: `${result.bankerRate}%`,
                    Player: `${result.playerRate}%`,
                    Tie: `${result.tieRate}%`,
                    tỉ_lệ: `${Math.max(result.bankerRate, result.playerRate, result.tieRate)}%`,
                    đúng: historyCorrect[id] ? historyCorrect[id].correct : 0,
                    sai: historyCorrect[id] ? historyCorrect[id].wrong : 0,
                    tỉ_lệ_thắng_bàn: `${winRate}%`,
                    cầu: result.pattern,
                    confidence: `${result.confidence}%`,
                    tie_signal: result.tie_signal,
                    stats: result.stats
                });
            }
        }

        res.json({
            success: true,
            data: results,
            total: results.length,
            id: '@tranhoang2286'
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// ROOT
// ============================================================
app.get('/', (req, res) => {
    res.json({
        name: 'BACCARAT PREDICTION - SIÊU MẠNH V8.0',
        version: '8.0.0',
        author: '@tranhoang2286',
        features: {
            dự_đoán: '3 cửa Banker, Player, Tie',
            tỉ_lệ: 'Mỗi tỉ lệ riêng biệt, không cộng dồn',
            tie_signal: 'Phát hiện Tie sắp xuất hiện',
            không_random: '100% không random',
            độ_tin_cậy: 'Lên đến 95%'
        },
        algorithms: [
            'Frequency', 'Streak', 'Zigzag',
            'Pattern 2-2, 3-3, 4-4',
            'Pattern 1-2-3, 2-1-2',
            'Markov 1 & 2',
            'Momentum', 'Entropy', 'Gap',
            'Fibonacci', 'Harmonic', 'Correlation',
            'Support/Resistance', 'Pivot', 'Trendline',
            'Volatility', 'Pattern Recognition',
            'Trend Analysis', 'Tie Analysis'
        ],
        total_algorithms: 23,
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all'
        }
    });
});

// ============================================================
// KHỞI ĐỘNG
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🃏 BACCARAT PREDICTION - SIÊU MẠNH V8.0');
    console.log('========================================');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log('📊 23 THUẬT TOÁN CON:');
    console.log('   1. Frequency        2. Streak          3. Zigzag');
    console.log('   4. Pattern 2-2      5. Pattern 3-3     6. Pattern 4-4');
    console.log('   7. Pattern 1-2-3    8. Pattern 2-1-2   9. Markov 1');
    console.log('   10. Markov 2        11. Momentum       12. Entropy');
    console.log('   13. Gap             14. Fibonacci      15. Harmonic');
    console.log('   16. Correlation     17. Support/Res    18. Pivot');
    console.log('   19. Trendline       20. Volatility     21. Pattern Rec');
    console.log('   22. Trend Analysis  23. Tie Analysis');
    console.log('========================================');
    console.log('📌 Dự đoán: Banker | Player | Tie');
    console.log('📌 Tỉ lệ riêng biệt, không cộng dồn');
    console.log('📌 Độ tin cậy lên đến 95%');
    console.log('📌 Không Random');
    console.log(`👤 Author: @tranhoang2286`);
    console.log('========================================');
});
