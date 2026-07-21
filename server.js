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
// CẤU HÌNH API GỐC
// ============================================================
const API_BASE = 'https://solid-computing-machine-uz8r.onrender.com';

// ============================================================
// LƯU DỮ LIỆU
// ============================================================
const sessionData = {};
const lastData = {};
const historyData = {};

// ============================================================
// HÀM CHUYỂN STRING -> ARRAY
// ============================================================
function toArray(str) {
    return str ? str.split('') : [];
}

// ============================================================
// LẤY DỮ LIỆU TỪ API GỐC
// ============================================================
async function fetchTableData(tableId) {
    try {
        const normalizedId = tableId.toUpperCase();
        const url = `${API_BASE}/api/baccarat/${normalizedId}`;
        console.log(`📡 Gọi API: ${url}`);
        
        const response = await axios.get(url, { timeout: 15000 });
        
        if (response.data && response.data.success && response.data.data) {
            return response.data.data.result || '';
        }
        return '';
    } catch (error) {
        console.error(`❌ Lỗi bàn ${tableId}:`, error.message);
        return '';
    }
}

// ============================================================
// THUẬT TOÁN 1: PHÂN TÍCH TẦN SUẤT NÂNG CAO
// ============================================================
function advancedFrequency(arr) {
    const total = arr.length || 1;
    const counts = { B: 0, P: 0, T: 0 };
    for (const c of arr) {
        if (counts[c] !== undefined) counts[c]++;
    }
    
    const probs = {
        B: counts.B / total,
        P: counts.P / total,
        T: counts.T / total
    };
    
    const adjusted = {
        B: probs.B * 0.6 + 0.18344,
        P: probs.P * 0.6 + 0.17848,
        T: probs.T * 0.6 + 0.03808
    };
    
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
// THUẬT TOÁN 2: PHÂN TÍCH STREAK CỰC CHI TIẾT
// ============================================================
function advancedStreak(arr) {
    if (arr.length < 2) return { max: 1, char: 'B', all: [], avg: { B: 0, P: 0, T: 0 }, prob: 0 };
    
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
    
    const avg = { B: 0, P: 0, T: 0 };
    const std = { B: 0, P: 0, T: 0 };
    for (const key of ['B', 'P', 'T']) {
        if (streaks[key].length > 0) {
            avg[key] = streaks[key].reduce((a, b) => a + b, 0) / streaks[key].length;
            const variance = streaks[key].reduce((a, b) => a + Math.pow(b - avg[key], 2), 0) / streaks[key].length;
            std[key] = Math.sqrt(variance);
        }
    }
    
    const lastChar = arr[arr.length - 1];
    const lastStreak = streaks[lastChar].length > 0 ? streaks[lastChar][streaks[lastChar].length - 1] : 1;
    const continueProb = lastStreak / (avg[lastChar] || 1);
    const zScore = (lastStreak - (avg[lastChar] || 1)) / (std[lastChar] || 1);
    
    return { 
        max, 
        char: maxChar, 
        all, 
        avg, 
        std,
        lastStreak, 
        continueProb: Math.min(continueProb, 1),
        zScore: Math.abs(zScore)
    };
}

// ============================================================
// THUẬT TOÁN 3: PHÂN TÍCH ZIGZAG CỰC CHI TIẾT
// ============================================================
function advancedZigzag(arr) {
    if (arr.length < 3) return { count: 0, positions: [], patterns: [], avg: 0 };
    
    let count = 0;
    const positions = [];
    const patterns = [];
    let totalLength = 0;
    
    for (let i = 1; i < arr.length - 1; i++) {
        if (arr[i] !== arr[i-1] && arr[i] !== arr[i+1]) {
            count++;
            positions.push(i);
            totalLength += i;
            patterns.push({ 
                pos: i, 
                char: arr[i], 
                prev: arr[i-1], 
                next: arr[i+1],
                length: i - (positions.length > 1 ? positions[positions.length - 2] : 0)
            });
        }
    }
    
    return { 
        count, 
        positions, 
        patterns,
        avgGap: count > 0 ? totalLength / count : 0
    };
}

// ============================================================
// THUẬT TOÁN 4: PATTERN 2-2 NÂNG CAO
// ============================================================
function advancedPattern22(arr) {
    if (arr.length < 4) return { count: 0, chars: [], positions: [], probability: 0 };
    
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
    
    // Xác suất pattern 2-2 tiếp tục
    let probability = 0;
    if (count > 0) {
        const lastPos = positions[positions.length - 1];
        const lastChar = chars[chars.length - 1];
        const nextPos = lastPos + 2;
        if (nextPos < arr.length - 1 && arr[nextPos] === lastChar && arr[nextPos + 1] === lastChar) {
            probability = 0.7;
        } else if (nextPos < arr.length - 1) {
            probability = 0.3;
        }
    }
    
    return { count, chars, positions, probability };
}

// ============================================================
// THUẬT TOÁN 5: PATTERN 3-3 NÂNG CAO
// ============================================================
function advancedPattern33(arr) {
    if (arr.length < 6) return { count: 0, chars: [], positions: [], probability: 0 };
    
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
    
    let probability = 0;
    if (count > 0) {
        const lastPos = positions[positions.length - 1];
        const lastChar = chars[chars.length - 1];
        const nextPos = lastPos + 3;
        if (nextPos < arr.length - 2 && 
            arr[nextPos] === lastChar && 
            arr[nextPos + 1] === lastChar && 
            arr[nextPos + 2] === lastChar) {
            probability = 0.75;
        }
    }
    
    return { count, chars, positions, probability };
}

// ============================================================
// THUẬT TOÁN 6: PATTERN 4-4
// ============================================================
function advancedPattern44(arr) {
    if (arr.length < 8) return { count: 0, probability: 0 };
    
    let count = 0;
    for (let i = 3; i < arr.length - 4; i += 4) {
        if (arr[i] === arr[i-1] && arr[i] === arr[i-2] && arr[i] === arr[i-3] &&
            arr[i+1] === arr[i+2] && arr[i+1] === arr[i+3] && arr[i+1] === arr[i+4]) {
            count++;
        }
    }
    
    return { count, probability: count > 0 ? 0.6 : 0 };
}

// ============================================================
// THUẬT TOÁN 7: PATTERN 1-2-3
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
// THUẬT TOÁN 8: PATTERN 2-1-2
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
    if (arr.length < 2) return { pred: 'B', prob: 0, matrix: null, entropy: 0 };
    
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
    let entropy = 0;
    
    if (trans) {
        const total = trans.B + trans.P + trans.T;
        if (total > 0) {
            for (const [key, val] of Object.entries(trans)) {
                const prob = val / total;
                if (prob > maxProb) {
                    maxProb = prob;
                    pred = key;
                }
                if (prob > 0) entropy -= prob * Math.log2(prob);
            }
        }
    }
    
    return { pred, prob: maxProb, matrix, entropy };
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
// THUẬT TOÁN 11: MARKOV BẬC 3
// ============================================================
function advancedMarkov3(arr) {
    if (arr.length < 4) return { pred: 'B', prob: 0 };
    
    const matrix = {};
    for (let i = 0; i < arr.length - 3; i++) {
        const key = arr[i] + arr[i+1] + arr[i+2];
        const next = arr[i+3];
        if (!matrix[key]) matrix[key] = { 'B': 0, 'P': 0, 'T': 0 };
        if (matrix[key][next] !== undefined) matrix[key][next]++;
    }
    
    const lastKey = arr.slice(-3).join('');
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
    return { pred, prob: maxProb };
}

// ============================================================
// THUẬT TOÁN 12: MOMENTUM NÂNG CAO
// ============================================================
function advancedMomentum(arr) {
    if (arr.length < 2) return { value: 0, acc: 0, velocities: [], trend: 'NEUTRAL' };
    
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
    
    let trend = 'NEUTRAL';
    if (momentum > 0.3) trend = 'BULLISH';
    else if (momentum < -0.3) trend = 'BEARISH';
    
    return { 
        value: momentum, 
        acc: acceleration, 
        velocities,
        trend,
        strength: Math.abs(momentum)
    };
}

// ============================================================
// THUẬT TOÁN 13: ENTROPY NÂNG CAO
// ============================================================
function advancedEntropy(arr) {
    if (arr.length < 3) return { value: 0, predictability: 0, normalized: 0 };
    
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
    
    return { 
        value: entropy, 
        predictability,
        normalized: entropy / maxEntropy
    };
}

// ============================================================
// THUẬT TOÁN 14: GAP ANALYSIS NÂNG CAO
// ============================================================
function advancedGap(arr) {
    if (arr.length < 3) return { pred: 'B', score: 0, gaps: null, avgGaps: null, zScores: null };
    
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
    const zScores = {};
    for (const key of ['B', 'P', 'T']) {
        currentGap[key] = arr.length - 1 - lastPos[key];
        zScores[key] = (currentGap[key] - avgGaps[key]) / (stdGaps[key] || 1);
    }
    
    let pred = 'B';
    let maxScore = 0;
    for (const key of ['B', 'P', 'T']) {
        const score = Math.abs(zScores[key]);
        if (score > maxScore) {
            maxScore = score;
            pred = key;
        }
    }
    
    return { pred, score: maxScore, gaps, avgGaps, currentGap, zScores };
}

// ============================================================
// THUẬT TOÁN 15: FIBONACCI NÂNG CAO
// ============================================================
function advancedFibonacci(arr) {
    if (arr.length < 3) return { pred: 'B', count: 0, positions: [], confidence: 0 };
    
    const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34];
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
    
    const confidence = Math.min(maxCount / positions.length, 0.8);
    
    return { pred, count: maxCount, positions, counts, confidence };
}

// ============================================================
// THUẬT TOÁN 16: HARMONIC NÂNG CAO
// ============================================================
function advancedHarmonic(arr) {
    if (arr.length < 4) return { count: 0, positions: [], score: 0 };
    
    let count = 0;
    const positions = [];
    for (let i = 0; i < arr.length - 3; i++) {
        if (arr[i] !== arr[i+1] && arr[i+1] !== arr[i+2] && arr[i+2] !== arr[i+3]) {
            count++;
            positions.push(i);
        }
    }
    
    const score = count / (arr.length - 3) * 100;
    return { count, positions, score };
}

// ============================================================
// THUẬT TOÁN 17: CORRELATION NÂNG CAO
// ============================================================
function advancedCorrelation(arr) {
    if (arr.length < 5) return { pred: 'B', corr: [], acf: [], strength: 0 };
    
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
    let strength = 0;
    
    if (corr.length > 0 && corr[0] > 0.3) {
        pred = lastValue > 0 ? 'B' : 'P';
        strength = corr[0];
    } else if (corr.length > 1 && corr[1] < -0.3) {
        pred = lastValue > 0 ? 'P' : 'B';
        strength = Math.abs(corr[1]);
    }
    
    return { pred, corr, acf, strength };
}

// ============================================================
// THUẬT TOÁN 18: SUPPORT & RESISTANCE
// ============================================================
function advancedSupportResistance(arr) {
    if (arr.length < 5) return { supports: 0, resistances: 0, supportValues: [], resistanceValues: [], trend: 'NEUTRAL' };
    
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
    
    let trend = 'NEUTRAL';
    if (supports.length > resistances.length + 1) trend = 'SUPPORT';
    else if (resistances.length > supports.length + 1) trend = 'RESISTANCE';
    
    return { 
        supports: supports.length, 
        resistances: resistances.length,
        supportValues: supports,
        resistanceValues: resistances,
        trend
    };
}

// ============================================================
// THUẬT TOÁN 19: PIVOT POINTS
// ============================================================
function advancedPivot(arr) {
    if (arr.length < 3) return { pivot: 0, r1: 0, s1: 0, r2: 0, s2: 0, position: 'MIDDLE' };
    
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    const high = Math.max(...values);
    const low = Math.min(...values);
    const close = values[values.length - 1];
    
    const pivot = (high + low + close) / 3;
    const r1 = 2 * pivot - low;
    const s1 = 2 * pivot - high;
    const r2 = pivot + (high - low);
    const s2 = pivot - (high - low);
    
    let position = 'MIDDLE';
    if (close > r1) position = 'OVERBOUGHT';
    else if (close < s1) position = 'OVERSOLD';
    else if (close > pivot) position = 'UPPER';
    else position = 'LOWER';
    
    return { pivot, r1, s1, r2, s2, high, low, close, position };
}

// ============================================================
// THUẬT TOÁN 20: TRENDLINE NÂNG CAO
// ============================================================
function advancedTrendline(arr) {
    if (arr.length < 5) return { slope: 0, intercept: 0, rSquared: 0, nextValue: 0, trend: 'NEUTRAL' };
    
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
    
    let trend = 'NEUTRAL';
    if (slope > 0.15) trend = 'BULLISH';
    else if (slope < -0.15) trend = 'BEARISH';
    
    return { 
        slope, 
        intercept, 
        rSquared, 
        nextValue: slope * n + intercept,
        trend,
        strength: Math.abs(slope)
    };
}

// ============================================================
// THUẬT TOÁN 21: VOLATILITY NÂNG CAO
// ============================================================
function advancedVolatility(arr) {
    if (arr.length < 3) return { value: 0, recent: 0, change: 0, isIncreasing: false, classification: 'LOW' };
    
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    const changes = [];
    for (let i = 1; i < values.length; i++) {
        changes.push(Math.abs(values[i] - values[i-1]));
    }
    
    const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
    const recent = changes.slice(-5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
    
    let classification = 'LOW';
    if (avg > 0.6) classification = 'HIGH';
    else if (avg > 0.3) classification = 'MEDIUM';
    
    return { 
        value: avg, 
        recent: recentAvg,
        change: recentAvg - avg,
        isIncreasing: recentAvg > avg * 1.1,
        classification
    };
}

// ============================================================
// THUẬT TOÁN 22: PATTERN RECOGNITION NÂNG CAO
// ============================================================
function advancedPatternRecognition(arr) {
    if (arr.length < 4) return { patterns: [], topPattern: null, diversity: 0 };
    
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
    
    const diversity = Math.min(Object.keys(patternMap).length / 10, 1);
    
    return { 
        patterns,
        topPattern: patterns.length > 0 ? patterns[0] : null,
        diversity
    };
}

// ============================================================
// THUẬT TOÁN 23: TREND ANALYSIS NÂNG CAO
// ============================================================
function advancedTrendAnalysis(arr) {
    if (arr.length < 10) return { trend: 'NEUTRAL', strength: 0, direction: 0, phases: [] };
    
    const window = Math.min(20, arr.length);
    const recent = arr.slice(-window);
    const values = recent.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    
    // Phân tích các phase
    const phases = [];
    const phaseSize = Math.floor(window / 4);
    for (let i = 0; i < 4; i++) {
        const start = i * phaseSize;
        const end = Math.min(start + phaseSize, values.length);
        const slice = values.slice(start, end);
        const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
        phases.push({ phase: i + 1, avg: avg, trend: avg > 0.1 ? 'UP' : avg < -0.1 ? 'DOWN' : 'NEUTRAL' });
    }
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const diff = avg2 - avg1;
    const strength = Math.abs(diff);
    
    let trend = 'NEUTRAL';
    if (diff > 0.2) trend = 'UP';
    else if (diff < -0.2) trend = 'DOWN';
    
    return { trend, strength, direction: diff, phases };
}

// ============================================================
// THUẬT TOÁN 24: TIE ANALYSIS CHUYÊN SÂU
// ============================================================
function advancedTieAnalysis(arr) {
    if (arr.length < 5) return { rate: 0, signal: false, score: 0, gap: 0, frequency: 0, positions: [] };
    
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
        if (currentGap >= gap * 0.7) {
            signal = true;
            score += 40;
        }
    }
    
    const recentWindow = Math.min(20, arr.length);
    const recentArr = arr.slice(-recentWindow);
    const recentTies = recentArr.filter(c => c === 'T').length;
    if (recentTies >= 2) {
        signal = true;
        score += 35;
    }
    
    if (recentTies === 0 && arr.length > 20) {
        signal = true;
        score += 30;
    }
    
    // Pattern 2-2 không có Tie
    let pattern22 = 0;
    for (let i = 1; i < Math.min(10, arr.length - 1); i += 2) {
        if (arr[arr.length - i] === arr[arr.length - i - 1]) {
            pattern22++;
        }
    }
    if (pattern22 >= 2 && recentTies === 0) {
        signal = true;
        score += 25;
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
        frequency: Math.round((tiePositions.length / arr.length) * 100),
        positions: tiePositions
    };
}

// ============================================================
// THUẬT TOÁN 25: PHÂN TÍCH 5 KẾT QUẢ GẦN NHẤT
// ============================================================
function advancedLast5(arr) {
    if (arr.length < 5) return { b: 0, p: 0, t: 0, trend: 'NEUTRAL', confidence: 0 };
    
    const last5 = arr.slice(-5);
    const b = last5.filter(c => c === 'B').length;
    const p = last5.filter(c => c === 'P').length;
    const t = last5.filter(c => c === 'T').length;
    
    let trend = 'NEUTRAL';
    let confidence = 0;
    
    if (b >= 4) {
        trend = 'STRONG_B';
        confidence = 0.8;
    } else if (p >= 4) {
        trend = 'STRONG_P';
        confidence = 0.8;
    } else if (b >= 3) {
        trend = 'WEAK_B';
        confidence = 0.6;
    } else if (p >= 3) {
        trend = 'WEAK_P';
        confidence = 0.6;
    } else if (t >= 2) {
        trend = 'TIE';
        confidence = 0.5;
    }
    
    return { b, p, t, trend, confidence };
}

// ============================================================
// THUẬT TOÁN 26: PHÂN TÍCH 10 KẾT QUẢ GẦN NHẤT
// ============================================================
function advancedLast10(arr) {
    if (arr.length < 10) return { b: 0, p: 0, t: 0, ratio: 0, trend: 'NEUTRAL' };
    
    const last10 = arr.slice(-10);
    const b = last10.filter(c => c === 'B').length;
    const p = last10.filter(c => c === 'P').length;
    const t = last10.filter(c => c === 'T').length;
    
    const ratio = b / (p || 1);
    let trend = 'NEUTRAL';
    if (ratio > 1.5) trend = 'BANKER_DOMINANT';
    else if (ratio < 0.67) trend = 'PLAYER_DOMINANT';
    else if (t >= 3) trend = 'TIE_FREQUENT';
    
    return { b, p, t, ratio, trend };
}

// ============================================================
// THUẬT TOÁN 27: PHÂN TÍCH CHU KỲ (CYCLE ANALYSIS)
// ============================================================
function advancedCycleAnalysis(arr) {
    if (arr.length < 10) return { cycle: 0, confidence: 0, patterns: [] };
    
    const cycles = [];
    for (let len = 2; len <= 5; len++) {
        let matchCount = 0;
        for (let i = 0; i < arr.length - len; i++) {
            if (arr[i] === arr[i + len]) matchCount++;
        }
        const ratio = matchCount / (arr.length - len);
        if (ratio > 0.6) {
            cycles.push({ length: len, ratio: ratio });
        }
    }
    
    const best = cycles.sort((a, b) => b.ratio - a.ratio)[0] || { length: 0, ratio: 0 };
    
    return { 
        cycle: best.length, 
        confidence: best.ratio,
        patterns: cycles
    };
}

// ============================================================
// THUẬT TOÁN 28: PHÂN TÍCH XÁC SUẤT CÓ ĐIỀU KIỆN
// ============================================================
function advancedConditionalProb(arr) {
    if (arr.length < 5) return { b_given_b: 0, p_given_p: 0, b_given_p: 0, p_given_b: 0 };
    
    let bb = 0, pp = 0, bp = 0, pb = 0;
    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] === 'B' && arr[i+1] === 'B') bb++;
        else if (arr[i] === 'P' && arr[i+1] === 'P') pp++;
        else if (arr[i] === 'B' && arr[i+1] === 'P') bp++;
        else if (arr[i] === 'P' && arr[i+1] === 'B') pb++;
    }
    
    const totalB = bb + bp || 1;
    const totalP = pp + pb || 1;
    
    return {
        b_given_b: bb / totalB,
        p_given_p: pp / totalP,
        b_given_p: pb / totalP,
        p_given_b: bp / totalB
    };
}

// ============================================================
// THUẬT TOÁN 29: PHÂN TÍCH ĐỘ BIẾN ĐỘNG CỰC ĐOAN
// ============================================================
function advancedExtreme(arr) {
    if (arr.length < 5) return { maxStreak: 0, maxRun: 0, volatility_score: 0 };
    
    let maxStreak = 1;
    let currentStreak = 1;
    let maxRun = 1;
    let currentRun = 1;
    
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === arr[i-1]) {
            currentStreak++;
            currentRun++;
        } else {
            if (currentStreak > maxStreak) maxStreak = currentStreak;
            currentStreak = 1;
            currentRun = 1;
        }
    }
    if (currentStreak > maxStreak) maxStreak = currentStreak;
    
    const volatility_score = Math.min(maxStreak / 5, 1);
    
    return { maxStreak, maxRun, volatility_score };
}

// ============================================================
// THUẬT TOÁN 30: PHÂN TÍCH TỔNG HỢP - CỰC MẠNH
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
    
    // ===== CHẠY TẤT CẢ 30 THUẬT TOÁN =====
    const freq = advancedFrequency(arr);
    const streak = advancedStreak(arr);
    const zigzag = advancedZigzag(arr);
    const pattern22 = advancedPattern22(arr);
    const pattern33 = advancedPattern33(arr);
    const pattern44 = advancedPattern44(arr);
    const pattern123 = advancedPattern123(arr);
    const pattern212 = advancedPattern212(arr);
    const markov1 = advancedMarkov1(arr);
    const markov2 = advancedMarkov2(arr);
    const markov3 = advancedMarkov3(arr);
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
    const last5 = advancedLast5(arr);
    const last10 = advancedLast10(arr);
    const cycle = advancedCycleAnalysis(arr);
    const condProb = advancedConditionalProb(arr);
    const extreme = advancedExtreme(arr);

    // ============================================================
    // TÍNH ĐIỂM TỔNG HỢP - CÂN BẰNG
    // ============================================================
    let bankerScore = 0;
    let playerScore = 0;
    let tieScore = 0;

    const weights = {
        frequency: 0.06,
        streak: 0.05,
        zigzag: 0.04,
        pattern22: 0.03,
        pattern33: 0.03,
        pattern44: 0.02,
        pattern123: 0.02,
        pattern212: 0.02,
        markov1: 0.04,
        markov2: 0.03,
        markov3: 0.02,
        momentum: 0.04,
        entropy: 0.03,
        gap: 0.03,
        fibonacci: 0.03,
        harmonic: 0.02,
        correlation: 0.03,
        support: 0.02,
        pivot: 0.02,
        trendline: 0.03,
        volatility: 0.02,
        patterns: 0.03,
        trend: 0.03,
        tie: 0.04,
        last5: 0.04,
        last10: 0.03,
        cycle: 0.02,
        condProb: 0.02,
        extreme: 0.02
    };

    // 1. Frequency
    bankerScore += freq.B * weights.frequency;
    playerScore += freq.P * weights.frequency;
    tieScore += freq.T * weights.frequency;

    // 2. Streak
    if (streak.max >= 4) {
        const reverse = streak.char === 'B' ? 'P' : 'B';
        if (reverse === 'B') bankerScore += 100 * weights.streak;
        else playerScore += 100 * weights.streak;
    } else if (streak.max >= 2) {
        if (streak.char === 'B') {
            bankerScore += 70 * weights.streak;
            playerScore += 30 * weights.streak;
        } else {
            playerScore += 70 * weights.streak;
            bankerScore += 30 * weights.streak;
        }
    } else {
        bankerScore += 50 * weights.streak;
        playerScore += 50 * weights.streak;
    }

    // 3. Zigzag
    if (zigzag.count >= 4) {
        const last = arr[arr.length - 1];
        if (last === 'P') {
            bankerScore += 100 * weights.zigzag;
            playerScore += 10 * weights.zigzag;
        } else if (last === 'B') {
            playerScore += 100 * weights.zigzag;
            bankerScore += 10 * weights.zigzag;
        }
    } else if (zigzag.count >= 2) {
        const last = arr[arr.length - 1];
        if (last === 'P') {
            bankerScore += 70 * weights.zigzag;
            playerScore += 30 * weights.zigzag;
        } else {
            playerScore += 70 * weights.zigzag;
            bankerScore += 30 * weights.zigzag;
        }
    } else {
        bankerScore += 50 * weights.zigzag;
        playerScore += 50 * weights.zigzag;
    }

    // 4. Pattern 2-2
    if (pattern22.count >= 2) {
        const reverse = pattern22.chars[0] === 'B' ? 'P' : 'B';
        if (reverse === 'B') bankerScore += 100 * weights.pattern22;
        else playerScore += 100 * weights.pattern22;
    } else if (pattern22.count >= 1) {
        const last = arr[arr.length - 1];
        if (last === 'B') {
            bankerScore += 70 * weights.pattern22;
            playerScore += 30 * weights.pattern22;
        } else {
            playerScore += 70 * weights.pattern22;
            bankerScore += 30 * weights.pattern22;
        }
    }

    // 5. Pattern 3-3
    if (pattern33.count >= 1) {
        const reverse = pattern33.chars[0] === 'B' ? 'P' : 'B';
        if (reverse === 'B') bankerScore += 100 * weights.pattern33;
        else playerScore += 100 * weights.pattern33;
    }

    // 6. Pattern 4-4
    if (pattern44.count >= 1) {
        const last = arr[arr.length - 1];
        if (last === 'B') playerScore += 100 * weights.pattern44;
        else bankerScore += 100 * weights.pattern44;
    }

    // 7. Markov
    if (markov1.prob > 0.4) {
        if (markov1.pred === 'B') {
            bankerScore += 80 * weights.markov1;
            playerScore += 20 * weights.markov1;
        } else {
            playerScore += 80 * weights.markov1;
            bankerScore += 20 * weights.markov1;
        }
    }
    if (markov2.prob > 0.4) {
        if (markov2.pred === 'B') {
            bankerScore += 80 * weights.markov2;
            playerScore += 20 * weights.markov2;
        } else {
            playerScore += 80 * weights.markov2;
            bankerScore += 20 * weights.markov2;
        }
    }

    // 8. Momentum
    if (momentum.value > 0.3) {
        bankerScore += 80 * weights.momentum;
        playerScore += 20 * weights.momentum;
    } else if (momentum.value < -0.3) {
        playerScore += 80 * weights.momentum;
        bankerScore += 20 * weights.momentum;
    }

    // 9. Entropy
    if (entropy.predictability > 0.6) {
        const freqPred = freq.B > freq.P ? 'B' : 'P';
        if (freqPred === 'B') {
            bankerScore += 80 * weights.entropy;
            playerScore += 20 * weights.entropy;
        } else {
            playerScore += 80 * weights.entropy;
            bankerScore += 20 * weights.entropy;
        }
    } else if (entropy.predictability < 0.3) {
        tieScore += 100 * weights.entropy;
    }

    // 10. Gap
    if (gap.score > 1.5) {
        if (gap.pred === 'B') bankerScore += 100 * weights.gap;
        else if (gap.pred === 'P') playerScore += 100 * weights.gap;
        else tieScore += 100 * weights.gap;
    }

    // 11. Fibonacci
    if (fibonacci.count >= 2) {
        if (fibonacci.pred === 'B') bankerScore += 100 * weights.fibonacci;
        else playerScore += 100 * weights.fibonacci;
    }

    // 12. Harmonic
    if (harmonic.score > 30) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 100 * weights.harmonic;
        else playerScore += 100 * weights.harmonic;
    }

    // 13. Correlation
    if (correlation.strength > 0.3) {
        if (correlation.pred === 'B') bankerScore += 100 * weights.correlation;
        else playerScore += 100 * weights.correlation;
    }

    // 14. Trendline
    if (trendline.rSquared > 0.3) {
        if (trendline.nextValue > 0.2) bankerScore += 100 * weights.trendline;
        else if (trendline.nextValue < -0.2) playerScore += 100 * weights.trendline;
    }

    // 15. Trend Analysis
    if (trend.trend === 'UP') bankerScore += 100 * weights.trend;
    else if (trend.trend === 'DOWN') playerScore += 100 * weights.trend;

    // 16. Tie Analysis
    if (tie.signal && tie.rate > 20) {
        tieScore += tie.rate * weights.tie * 2;
    } else {
        tieScore += tie.rate * weights.tie;
    }

    // 17. Last 5
    if (last5.trend === 'STRONG_B') {
        playerScore += 100 * weights.last5;
        bankerScore += 10 * weights.last5;
    } else if (last5.trend === 'STRONG_P') {
        bankerScore += 100 * weights.last5;
        playerScore += 10 * weights.last5;
    } else if (last5.trend === 'WEAK_B') {
        bankerScore += 70 * weights.last5;
        playerScore += 30 * weights.last5;
    } else if (last5.trend === 'WEAK_P') {
        playerScore += 70 * weights.last5;
        bankerScore += 30 * weights.last5;
    }

    // 18. Last 10
    if (last10.trend === 'BANKER_DOMINANT') {
        playerScore += 80 * weights.last10;
        bankerScore += 20 * weights.last10;
    } else if (last10.trend === 'PLAYER_DOMINANT') {
        bankerScore += 80 * weights.last10;
        playerScore += 20 * weights.last10;
    }

    // 19. Cycle
    if (cycle.cycle > 0 && cycle.confidence > 0.6) {
        const cyclePred = arr[arr.length - cycle.cycle];
        if (cyclePred === 'B') bankerScore += 100 * weights.cycle;
        else if (cyclePred === 'P') playerScore += 100 * weights.cycle;
        else tieScore += 100 * weights.cycle;
    }

    // 20. Conditional Probability
    if (condProb.b_given_b > 0.6) {
        bankerScore += 80 * weights.condProb;
        playerScore += 20 * weights.condProb;
    }
    if (condProb.p_given_p > 0.6) {
        playerScore += 80 * weights.condProb;
        bankerScore += 20 * weights.condProb;
    }

    // 21. Extreme
    if (extreme.maxStreak >= 5) {
        const reverse = arr[arr.length - 1] === 'B' ? 'P' : 'B';
        if (reverse === 'B') bankerScore += 100 * weights.extreme;
        else playerScore += 100 * weights.extreme;
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
    
    if (tie.signal && tieRate > 20 && tieRate > bankerRate && tieRate > playerRate) {
        prediction = 'Tie';
    } else if (maxRate === bankerRate) {
        prediction = 'Banker';
    } else if (maxRate === playerRate) {
        prediction = 'Player';
    } else {
        prediction = 'Tie';
    }

    // ============================================================
    // LÀM TRÒN
    // ============================================================
    let b = Math.round(bankerRate);
    let p = Math.round(playerRate);
    let t = Math.round(tieRate);

    if (b === 50) b = 51;
    if (p === 50) p = 49;
    if (t === 50) t = 6;

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
    if (tie.signal && t > 20) {
        confidence = Math.min(confidence + 5, 92);
    }
    confidence = Math.max(50, Math.min(confidence, 92));

    // ============================================================
    // PHÂN TÍCH CẦU
    // ============================================================
    let pattern = 'Cầu đan xen';
    if (prediction === 'Tie' && tie.signal) {
        pattern = `🔮 TIE SIGNAL! Cách ${tie.gap} ván, Tần suất ${tie.frequency}%`;
    } else if (streak.max >= 4) {
        pattern = `Dây ${streak.char} x${streak.max} - Sắp đảo chiều`;
    } else if (zigzag.count >= 4) {
        pattern = `Zigzag ${zigzag.count} lần`;
    } else if (pattern22.count >= 2 && pattern33.count >= 1) {
        pattern = `Cầu 2-2 (${pattern22.count}) + 3-3 (${pattern33.count})`;
    } else if (pattern22.count >= 2) {
        pattern = `Cầu 2-2 (${pattern22.count} lần)`;
    } else if (pattern33.count >= 1) {
        pattern = `Cầu 3-3`;
    } else if (pattern44.count >= 1) {
        pattern = `Cầu 4-4`;
    } else if (freq.B > 55) {
        pattern = `Banker áp đảo ${Math.round(freq.B)}% - Có thể đảo chiều`;
    } else if (freq.P > 55) {
        pattern = `Player áp đảo ${Math.round(freq.P)}% - Có thể đảo chiều`;
    } else if (freq.T > 10) {
        pattern = `Tie xuất hiện nhiều ${Math.round(freq.T)}%`;
    } else if (trend.trend === 'UP') {
        pattern = `Xu hướng Banker (${Math.round(trend.strength * 100)}%)`;
    } else if (trend.trend === 'DOWN') {
        pattern = `Xu hướng Player (${Math.round(trend.strength * 100)}%)`;
    }

    // ============================================================
    // LƯU KẾT QUẢ THUẬT TOÁN
    // ============================================================
    const algorithms = {
        frequency: { B: Math.round(freq.B), P: Math.round(freq.P), T: Math.round(freq.T) },
        streak: { char: streak.char, max: streak.max },
        zigzag: { count: zigzag.count },
        pattern22: { count: pattern22.count },
        pattern33: { count: pattern33.count },
        pattern44: { count: pattern44.count },
        pattern123: { count: pattern123.count },
        pattern212: { count: pattern212.count },
        markov1: { pred: markov1.pred, prob: Math.round(markov1.prob * 100) },
        markov2: { pred: markov2.pred, prob: Math.round(markov2.prob * 100) },
        markov3: { pred: markov3.pred, prob: Math.round(markov3.prob * 100) },
        momentum: { value: Math.round(momentum.value * 100) / 100, trend: momentum.trend },
        entropy: { value: Math.round(entropy.value * 10) / 10, predictability: Math.round(entropy.predictability * 100) },
        gap: { pred: gap.pred, score: Math.round(gap.score * 100) / 100 },
        fibonacci: { pred: fibonacci.pred, count: fibonacci.count },
        harmonic: { count: harmonic.count, score: Math.round(harmonic.score) },
        correlation: { pred: correlation.pred, strength: Math.round(correlation.strength * 100) },
        support: { supports: support.supports, resistances: support.resistances },
        trendline: { slope: Math.round(trendline.slope * 100) / 100, rSquared: Math.round(trendline.rSquared * 100) },
        volatility: { value: Math.round(volatility.value * 100) / 100, classification: volatility.classification },
        trend: { trend: trend.trend, strength: Math.round(trend.strength * 100) },
        tie: { rate: tie.rate, signal: tie.signal, gap: tie.gap },
        last5: { trend: last5.trend, b: last5.b, p: last5.p, t: last5.t },
        last10: { trend: last10.trend, b: last10.b, p: last10.p, t: last10.t },
        cycle: { length: cycle.cycle, confidence: Math.round(cycle.confidence * 100) },
        condProb: { 
            b_given_b: Math.round(condProb.b_given_b * 100),
            p_given_p: Math.round(condProb.p_given_p * 100)
        },
        extreme: { maxStreak: extreme.maxStreak }
    };

    return {
        prediction: prediction,
        bankerRate: Math.max(b, 3),
        playerRate: Math.max(p, 3),
        tieRate: Math.max(t, 2),
        pattern: pattern,
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
            predictability: Math.round(entropy.predictability * 100),
            volatility: volatility.classification
        },
        algorithms: algorithms
    };
}

// ============================================================
// API ROUTES
// ============================================================
app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const cauGoc = await fetchTableData(tableId);

        if (!cauGoc) {
            return res.json({
                success: false,
                message: `Không tìm thấy bàn ${tableId}`
            });
        }

        const oldData = lastData[tableId] || '';
        const isNewData = (cauGoc !== oldData && cauGoc.length > oldData.length);
        lastData[tableId] = cauGoc;

        if (!sessionData[tableId]) sessionData[tableId] = 0;
        if (isNewData) sessionData[tableId]++;

        const result = predictBCR(cauGoc);
        const tiePrediction = result.tie_signal ? 'CÓ' : 'KHÔNG';

        res.json({
            success: true,
            bàn: `Bàn ${tableId}`,
            phiên: sessionData[tableId],
            cầu_gốc: cauGoc,
            dự_đoán: result.prediction,
            tỉ_lệ: `${Math.max(result.bankerRate, result.playerRate, result.tieRate)}%`,
            dự_đoán_tie: tiePrediction,
            tỉ_lệ_tie: `${result.tieRate}%`,
            cầu: result.pattern,
            confidence: `${result.confidence}%`,
            stats: result.stats,
            algorithms: result.algorithms,
            id: '@tranhoang2286'
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/predict/all', async (req, res) => {
    try {
        const tableIds = ['C01', 'C02', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C15', 'C16', 'C17', 'C18', 'C19', 'C20'];
        const results = [];

        for (const id of tableIds) {
            const cauGoc = await fetchTableData(id);
            if (cauGoc) {
                const oldData = lastData[id] || '';
                const isNewData = (cauGoc !== oldData && cauGoc.length > oldData.length);
                lastData[id] = cauGoc;

                if (!sessionData[id]) sessionData[id] = 0;
                if (isNewData) sessionData[id]++;

                const result = predictBCR(cauGoc);
                const tiePrediction = result.tie_signal ? 'CÓ' : 'KHÔNG';

                results.push({
                    bàn: `Bàn ${id}`,
                    phiên: sessionData[id],
                    cầu_gốc: cauGoc,
                    dự_đoán: result.prediction,
                    tỉ_lệ: `${Math.max(result.bankerRate, result.playerRate, result.tieRate)}%`,
                    dự_đoán_tie: tiePrediction,
                    tỉ_lệ_tie: `${result.tieRate}%`,
                    cầu: result.pattern,
                    confidence: `${result.confidence}%`
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

app.get('/api/baccarat/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const result = await fetchTableData(tableId);
        
        if (result) {
            res.json({
                success: true,
                data: {
                    table: tableId,
                    result: result,
                    shoeId: '',
                    round: ''
                }
            });
        } else {
            res.json({
                success: false,
                message: `Không tìm thấy bàn ${tableId}`
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// ROOT
// ============================================================
app.get('/', (req, res) => {
    res.json({
        name: 'BACCARAT PREDICTION - 30 THUẬT TOÁN',
        version: '13.0.0',
        author: '@tranhoang2286',
        api_source: API_BASE,
        features: {
            không_random: '100% không random',
            cân_bằng: 'Không thiên vị bất kỳ cửa nào',
            tie_signal: 'Phát hiện Tie sắp xuất hiện',
            độ_tin_cậy: 'Lên đến 92%'
        },
        total_algorithms: 30,
        algorithms: [
            'Tần suất nâng cao', 'Streak chi tiết', 'Zigzag chi tiết',
            'Pattern 2-2', 'Pattern 3-3', 'Pattern 4-4',
            'Pattern 1-2-3', 'Pattern 2-1-2',
            'Markov 1', 'Markov 2', 'Markov 3',
            'Momentum nâng cao', 'Entropy nâng cao', 'Gap nâng cao',
            'Fibonacci', 'Harmonic', 'Correlation',
            'Support/Resistance', 'Pivot Points', 'Trendline',
            'Volatility', 'Pattern Recognition', 'Trend Analysis',
            'Tie Analysis', 'Last 5', 'Last 10',
            'Cycle Analysis', 'Conditional Probability', 'Extreme Analysis'
        ],
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all',
            'Lấy dữ liệu bàn': '/api/baccarat/:tableId'
        }
    });
});

// ============================================================
// KHỞI ĐỘNG
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🃏 BACCARAT PREDICTION - 30 THUẬT TOÁN');
    console.log('========================================');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📡 API Source: ${API_BASE}`);
    console.log('📊 30 THUẬT TOÁN CON:');
    console.log('   1. Tần suất nâng cao      2. Streak chi tiết');
    console.log('   3. Zigzag chi tiết       4. Pattern 2-2');
    console.log('   5. Pattern 3-3           6. Pattern 4-4');
    console.log('   7. Pattern 1-2-3         8. Pattern 2-1-2');
    console.log('   9. Markov 1             10. Markov 2');
    console.log('   11. Markov 3            12. Momentum nâng cao');
    console.log('   13. Entropy nâng cao    14. Gap nâng cao');
    console.log('   15. Fibonacci           16. Harmonic');
    console.log('   17. Correlation         18. Support/Resistance');
    console.log('   19. Pivot Points        20. Trendline');
    console.log('   21. Volatility          22. Pattern Recognition');
    console.log('   23. Trend Analysis      24. Tie Analysis');
    console.log('   25. Last 5              26. Last 10');
    console.log('   27. Cycle Analysis      28. Conditional Prob');
    console.log('   29. Extreme Analysis    30. Tổng hợp');
    console.log('========================================');
    console.log('📌 KHÔNG RANDOM - CÂN BẰNG - KHÔNG THIÊN VỊ');
    console.log(`👤 Author: @tranhoang2286`);
    console.log('========================================');
});
