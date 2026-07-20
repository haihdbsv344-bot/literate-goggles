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
const allPatterns = {};

// ============================================================
// HÀM CHUYỂN STRING -> ARRAY
// ============================================================
function toArray(str) {
    return str ? str.split('') : [];
}

// ============================================================
// THUẬT TOÁN 1: PHÂN TÍCH DÂY (STREAK)
// ============================================================
function analyzeStreak(arr) {
    if (arr.length < 2) return { max: 1, char: 'B', all: [] };
    
    let current = 1;
    let max = 1;
    let maxChar = arr[0];
    const all = [];
    
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
            }
            current = 1;
        }
    }
    if (current >= 2) {
        all.push({ char: arr[arr.length-1], length: current });
    }
    
    return { max, char: maxChar, all };
}

// ============================================================
// THUẬT TOÁN 2: PHÂN TÍCH ĐAN XEN (ZIGZAG)
// ============================================================
function analyzeZigzag(arr) {
    if (arr.length < 3) return { count: 0, positions: [] };
    
    let count = 0;
    const positions = [];
    for (let i = 1; i < arr.length - 1; i++) {
        if (arr[i] !== arr[i-1] && arr[i] !== arr[i+1]) {
            count++;
            positions.push(i);
        }
    }
    return { count, positions };
}

// ============================================================
// THUẬT TOÁN 3: PHÂN TÍCH CẦU 2-2
// ============================================================
function analyzePattern22(arr) {
    if (arr.length < 4) return { count: 0, chars: [] };
    
    let count = 0;
    const chars = [];
    for (let i = 1; i < arr.length - 2; i += 2) {
        if (arr[i] === arr[i-1] && arr[i+1] === arr[i+2]) {
            count++;
            chars.push(arr[i]);
        }
    }
    return { count, chars };
}

// ============================================================
// THUẬT TOÁN 4: PHÂN TÍCH CẦU 3-3
// ============================================================
function analyzePattern33(arr) {
    if (arr.length < 6) return { count: 0, chars: [] };
    
    let count = 0;
    const chars = [];
    for (let i = 2; i < arr.length - 3; i += 3) {
        if (arr[i] === arr[i-1] && arr[i] === arr[i-2] &&
            arr[i+1] === arr[i+2] && arr[i+1] === arr[i+3]) {
            count++;
            chars.push(arr[i]);
        }
    }
    return { count, chars };
}

// ============================================================
// THUẬT TOÁN 5: PHÂN TÍCH CẦU 4-4
// ============================================================
function analyzePattern44(arr) {
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
// THUẬT TOÁN 6: PHÂN TÍCH CẦU 1-2-3
// ============================================================
function analyzePattern123(arr) {
    if (arr.length < 6) return { count: 0 };
    
    let count = 0;
    for (let i = 0; i < arr.length - 6; i++) {
        if (arr[i] !== arr[i+1] &&
            arr[i+1] === arr[i+2] &&
            arr[i+2] !== arr[i+3] &&
            arr[i+3] === arr[i+4] &&
            arr[i+4] === arr[i+5]) {
            count++;
        }
    }
    return { count };
}

// ============================================================
// THUẬT TOÁN 7: PHÂN TÍCH CẦU 2-1-2
// ============================================================
function analyzePattern212(arr) {
    if (arr.length < 5) return { count: 0 };
    
    let count = 0;
    for (let i = 0; i < arr.length - 5; i++) {
        if (arr[i] === arr[i+1] &&
            arr[i+1] !== arr[i+2] &&
            arr[i+2] === arr[i+3] &&
            arr[i+3] === arr[i+4]) {
            count++;
        }
    }
    return { count };
}

// ============================================================
// THUẬT TOÁN 8: MARKOV BẬC 1
// ============================================================
function analyzeMarkov1(arr) {
    if (arr.length < 2) return { pred: 'B', prob: 0 };
    
    const matrix = { 'B': { 'B': 0, 'P': 0, 'T': 0 }, 'P': { 'B': 0, 'P': 0, 'T': 0 }, 'T': { 'B': 0, 'P': 0, 'T': 0 } };
    for (let i = 0; i < arr.length - 1; i++) {
        if (matrix[arr[i]] && matrix[arr[i]][arr[i+1]] !== undefined) {
            matrix[arr[i]][arr[i+1]]++;
        }
    }
    
    const last = arr[arr.length - 1];
    const trans = matrix[last];
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
// THUẬT TOÁN 9: MARKOV BẬC 2
// ============================================================
function analyzeMarkov2(arr) {
    if (arr.length < 3) return { pred: 'B', prob: 0 };
    
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
    return { pred, prob: maxProb };
}

// ============================================================
// THUẬT TOÁN 10: PHÂN TÍCH MOMENTUM
// ============================================================
function analyzeMomentum(arr) {
    if (arr.length < 2) return { value: 0, acc: 0 };
    
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
    
    return { value: momentum, acc: acceleration };
}

// ============================================================
// THUẬT TOÁN 11: PHÂN TÍCH ENTROPY
// ============================================================
function analyzeEntropy(arr) {
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
// THUẬT TOÁN 12: PHÂN TÍCH GAP (KHOẢNG CÁCH)
// ============================================================
function analyzeGap(arr) {
    if (arr.length < 3) return { pred: 'B', score: 0 };
    
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
    
    return { pred, score: maxScore };
}

// ============================================================
// THUẬT TOÁN 13: FIBONACCI
// ============================================================
function analyzeFibonacci(arr) {
    if (arr.length < 3) return { pred: 'B', count: 0 };
    
    const fib = [1, 1, 2, 3, 5, 8, 13];
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
    
    return { pred, count: maxCount };
}

// ============================================================
// THUẬT TOÁN 14: HARMONIC
// ============================================================
function analyzeHarmonic(arr) {
    if (arr.length < 4) return { count: 0 };
    
    let count = 0;
    for (let i = 0; i < arr.length - 3; i++) {
        if (arr[i] !== arr[i+1] && arr[i+1] !== arr[i+2] && arr[i+2] !== arr[i+3]) {
            count++;
        }
    }
    return { count };
}

// ============================================================
// THUẬT TOÁN 15: CORRELATION
// ============================================================
function analyzeCorrelation(arr) {
    if (arr.length < 5) return { pred: 'B', corr: [] };
    
    const seq = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    const n = seq.length;
    const mean = seq.reduce((a, b) => a + b, 0) / n;
    const variance = seq.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    
    const corr = [];
    for (let lag = 1; lag <= Math.min(5, n - 1); lag++) {
        let sum = 0;
        for (let i = 0; i < n - lag; i++) {
            sum += (seq[i] - mean) * (seq[i + lag] - mean);
        }
        corr.push(sum / ((n - lag) * variance));
    }
    
    const lastValue = seq[n - 1];
    let pred = 'B';
    if (corr.length > 0 && corr[0] > 0.3) {
        pred = lastValue > 0 ? 'B' : 'P';
    } else if (corr.length > 1 && corr[1] < -0.3) {
        pred = lastValue > 0 ? 'P' : 'B';
    }
    
    return { pred, corr };
}

// ============================================================
// THUẬT TOÁN 16: SUPPORT & RESISTANCE
// ============================================================
function analyzeSupportResistance(arr) {
    if (arr.length < 5) return { supports: 0, resistances: 0 };
    
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    let supports = 0;
    let resistances = 0;
    
    for (let i = 2; i < values.length - 2; i++) {
        if (values[i] < values[i-1] && values[i] < values[i-2] &&
            values[i] < values[i+1] && values[i] < values[i+2]) {
            supports++;
        }
        if (values[i] > values[i-1] && values[i] > values[i-2] &&
            values[i] > values[i+1] && values[i] > values[i+2]) {
            resistances++;
        }
    }
    
    return { supports, resistances };
}

// ============================================================
// THUẬT TOÁN 17: PIVOT POINTS
// ============================================================
function analyzePivot(arr) {
    if (arr.length < 3) return { pivot: 0, r1: 0, s1: 0 };
    
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    const high = Math.max(...values);
    const low = Math.min(...values);
    const close = values[values.length - 1];
    
    const pivot = (high + low + close) / 3;
    const r1 = 2 * pivot - low;
    const s1 = 2 * pivot - high;
    
    return { pivot, r1, s1 };
}

// ============================================================
// THUẬT TOÁN 18: TRENDLINE
// ============================================================
function analyzeTrendline(arr) {
    if (arr.length < 5) return { slope: 0, rSquared: 0 };
    
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
    
    return { slope, rSquared };
}

// ============================================================
// THUẬT TOÁN 19: VOLATILITY
// ============================================================
function analyzeVolatility(arr) {
    if (arr.length < 3) return { value: 0, recent: 0 };
    
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    const changes = [];
    for (let i = 1; i < values.length; i++) {
        changes.push(Math.abs(values[i] - values[i-1]));
    }
    
    const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
    const recent = changes.slice(-5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
    
    return { value: avg, recent: recentAvg };
}

// ============================================================
// THUẬT TOÁN 20: PATTERN RECOGNITION
// ============================================================
function analyzePatternRecognition(arr) {
    if (arr.length < 4) return { patterns: [] };
    
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
    
    return { patterns };
}

// ============================================================
// THUẬT TOÁN TỔNG HỢP - KHÔNG RANDOM
// ============================================================
function predictBCR(history) {
    if (!history || history.length < 3) {
        return {
            prediction: 'Player',
            banker: 48,
            player: 48,
            tie: 4,
            pattern: 'Chưa đủ dữ liệu',
            cau_goc: history || ''
        };
    }

    const arr = toArray(history);
    const total = arr.length;

    // ===== CHẠY TẤT CẢ THUẬT TOÁN =====
    const streak = analyzeStreak(arr);
    const zigzag = analyzeZigzag(arr);
    const pattern22 = analyzePattern22(arr);
    const pattern33 = analyzePattern33(arr);
    const pattern44 = analyzePattern44(arr);
    const pattern123 = analyzePattern123(arr);
    const pattern212 = analyzePattern212(arr);
    const markov1 = analyzeMarkov1(arr);
    const markov2 = analyzeMarkov2(arr);
    const momentum = analyzeMomentum(arr);
    const entropy = analyzeEntropy(arr);
    const gap = analyzeGap(arr);
    const fibonacci = analyzeFibonacci(arr);
    const harmonic = analyzeHarmonic(arr);
    const correlation = analyzeCorrelation(arr);
    const support = analyzeSupportResistance(arr);
    const pivot = analyzePivot(arr);
    const trendline = analyzeTrendline(arr);
    const volatility = analyzeVolatility(arr);
    const patterns = analyzePatternRecognition(arr);

    // ===== TẦN SUẤT =====
    const counts = { B: 0, P: 0, T: 0 };
    for (const c of arr) {
        if (counts[c] !== undefined) counts[c]++;
    }
    const bPercent = (counts.B / total) * 100;
    const pPercent = (counts.P / total) * 100;
    const tPercent = (counts.T / total) * 100;

    // ============================================================
    // TỔNG HỢP ĐIỂM - KHÔNG RANDOM
    // ============================================================
    let bankerScore = 0;
    let playerScore = 0;
    let tieScore = 0;

    const weights = {
        frequency: 0.10,
        streak: 0.08,
        zigzag: 0.07,
        pattern22: 0.06,
        pattern33: 0.05,
        pattern44: 0.04,
        pattern123: 0.04,
        pattern212: 0.04,
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
        trendline: 0.03,
        volatility: 0.03,
        patterns: 0.05
    };

    // 1. Frequency
    bankerScore += bPercent * weights.frequency;
    playerScore += pPercent * weights.frequency;
    tieScore += tPercent * weights.frequency;

    // 2. Streak
    if (streak.max >= 4) {
        if (streak.char === 'B') bankerScore += 100 * weights.streak;
        else if (streak.char === 'P') playerScore += 100 * weights.streak;
        else tieScore += 100 * weights.streak;
    } else {
        bankerScore += 50 * weights.streak;
        playerScore += 50 * weights.streak;
    }

    // 3. Zigzag
    if (zigzag.count >= 4) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 100 * weights.zigzag;
        else if (last === 'B') playerScore += 100 * weights.zigzag;
        else tieScore += 100 * weights.zigzag;
    } else {
        bankerScore += 50 * weights.zigzag;
        playerScore += 50 * weights.zigzag;
    }

    // 4. Pattern 2-2
    if (pattern22.count >= 2) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 100 * weights.pattern22;
        else if (last === 'B') playerScore += 100 * weights.pattern22;
        else tieScore += 100 * weights.pattern22;
    }

    // 5. Pattern 3-3
    if (pattern33.count >= 1) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 100 * weights.pattern33;
        else if (last === 'B') playerScore += 100 * weights.pattern33;
        else tieScore += 100 * weights.pattern33;
    }

    // 6. Pattern 4-4
    if (pattern44.count >= 1) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 100 * weights.pattern44;
        else if (last === 'B') playerScore += 100 * weights.pattern44;
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
    }

    // 10. Markov 2
    if (markov2.prob > 0.4) {
        if (markov2.pred === 'B') bankerScore += 100 * weights.markov2;
        else if (markov2.pred === 'P') playerScore += 100 * weights.markov2;
        else tieScore += 100 * weights.markov2;
    }

    // 11. Momentum
    if (Math.abs(momentum.value) > 0.3) {
        if (momentum.value > 0) bankerScore += 100 * weights.momentum;
        else playerScore += 100 * weights.momentum;
    }

    // 12. Entropy
    if (entropy.predictability > 0.6) {
        const freqPred = bPercent > pPercent ? 'B' : 'P';
        if (freqPred === 'B') bankerScore += 100 * weights.entropy;
        else playerScore += 100 * weights.entropy;
    } else if (entropy.predictability < 0.3) {
        tieScore += 100 * weights.entropy;
    }

    // 13. Gap
    if (gap.score > 1.5) {
        if (gap.pred === 'B') bankerScore += 100 * weights.gap;
        else if (gap.pred === 'P') playerScore += 100 * weights.gap;
        else tieScore += 100 * weights.gap;
    }

    // 14. Fibonacci
    if (fibonacci.count >= 2) {
        if (fibonacci.pred === 'B') bankerScore += 100 * weights.fibonacci;
        else if (fibonacci.pred === 'P') playerScore += 100 * weights.fibonacci;
        else tieScore += 100 * weights.fibonacci;
    }

    // 15. Harmonic
    if (harmonic.count >= 4) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 100 * weights.harmonic;
        else if (last === 'B') playerScore += 100 * weights.harmonic;
        else tieScore += 100 * weights.harmonic;
    }

    // 16. Correlation
    if (correlation.pred === 'B') bankerScore += 100 * weights.correlation;
    else if (correlation.pred === 'P') playerScore += 100 * weights.correlation;
    else tieScore += 100 * weights.correlation;

    // 17. Support
    if (support.supports > support.resistances) {
        bankerScore += 100 * weights.support;
    } else if (support.resistances > support.supports) {
        playerScore += 100 * weights.support;
    }

    // 18. Pivot
    if (pivot.pivot !== 0) {
        const lastValue = arr[arr.length - 1] === 'B' ? 1 : arr[arr.length - 1] === 'P' ? -1 : 0;
        if (lastValue > pivot.pivot) bankerScore += 100 * weights.pivot;
        else if (lastValue < pivot.pivot) playerScore += 100 * weights.pivot;
    }

    // 19. Trendline
    if (trendline.rSquared > 0.3) {
        if (trendline.slope > 0) bankerScore += 100 * weights.trendline;
        else if (trendline.slope < 0) playerScore += 100 * weights.trendline;
    }

    // 20. Volatility
    if (volatility.recent < volatility.value * 0.8) {
        const last = arr[arr.length - 1];
        if (last === 'B') bankerScore += 100 * weights.volatility;
        else if (last === 'P') playerScore += 100 * weights.volatility;
    }

    // 21. Pattern Recognition
    if (patterns.patterns.length > 0) {
        const topPattern = patterns.patterns[0];
        const nextChar = topPattern.pattern[topPattern.pattern.length - 1];
        if (nextChar === 'B') bankerScore += 100 * weights.patterns;
        else if (nextChar === 'P') playerScore += 100 * weights.patterns;
        else tieScore += 100 * weights.patterns;
    }

    // ===== CHUẨN HÓA =====
    const totalScore = bankerScore + playerScore + tieScore || 1;
    let banker = (bankerScore / totalScore) * 100;
    let player = (playerScore / totalScore) * 100;
    let tie = (tieScore / totalScore) * 100;

    // Điều chỉnh theo xác suất thực tế
    banker = banker * 0.7 + 13.76;
    player = player * 0.7 + 13.39;
    tie = tie * 0.7 + 2.86;

    const sum = banker + player + tie;
    banker = (banker / sum) * 100;
    player = (player / sum) * 100;
    tie = (tie / sum) * 100;

    // ===== XÁC ĐỊNH DỰ ĐOÁN =====
    let prediction = 'Player';
    let maxRate = Math.max(banker, player, tie);
    if (maxRate === banker) prediction = 'Banker';
    else if (maxRate === player) prediction = 'Player';
    else prediction = 'Tie';

    // ===== LÀM TRÒN =====
    let b = Math.round(banker);
    let p = Math.round(player);
    let t = Math.round(tie);

    if (b === 50) b = 51;
    if (p === 50) p = 49;
    if (t === 50) t = 5;

    const totalRates = b + p + t;
    if (totalRates !== 100) {
        const diff = 100 - totalRates;
        if (b > p && b > t) b += diff;
        else if (p > b && p > t) p += diff;
        else t += diff;
    }

    // ===== PHÂN TÍCH CẦU GỐC =====
    let cauGoc = history;
    let cau5 = arr.slice(-5).join('');
    let cau10 = arr.slice(-10).join('');
    let cau3 = arr.slice(-3).join('');

    // Mô tả cầu
    let patternDesc = 'Cầu đan xen';
    if (streak.max >= 4) {
        patternDesc = `Dây ${streak.char} x${streak.max}`;
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
    } else if (pattern123.count >= 1) {
        patternDesc = `Cầu 1-2-3`;
    } else if (pattern212.count >= 1) {
        patternDesc = `Cầu 2-1-2`;
    } else if (bPercent > 55) {
        patternDesc = `Banker áp đảo ${Math.round(bPercent)}%`;
    } else if (pPercent > 55) {
        patternDesc = `Player áp đảo ${Math.round(pPercent)}%`;
    } else if (tPercent > 10) {
        patternDesc = `Tie xuất hiện nhiều ${Math.round(tPercent)}%`;
    }

    return {
        prediction: prediction,
        banker: Math.max(b, 3),
        player: Math.max(p, 3),
        tie: Math.max(t, 2),
        pattern: patternDesc,
        cau_goc: cauGoc,
        cau_5: cau5,
        cau_10: cau10,
        cau_3: cau3,
        stats: {
            B: Math.round(bPercent),
            P: Math.round(pPercent),
            T: Math.round(tPercent)
        }
    };
}

// ============================================================
// LẤY DỮ LIỆU TỪ API
// ============================================================
async function fetchTableData(tableId) {
    try {
        const url = `https://solid-computing-machine-uz8r.onrender.com/api/baccarat/${tableId}`;
        const response = await axios.get(url, { timeout: 10000 });
        if (response.data && response.data.success && response.data.data) {
            return response.data.data.result || '';
        }
        return '';
    } catch (error) {
        console.error(`Lỗi bàn ${tableId}:`, error.message);
        return '';
    }
}

// ============================================================
// API DỰ ĐOÁN TỪNG BÀN - GỌN
// ============================================================
app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId;
        const history = await fetchTableData(tableId);

        if (!history) {
            return res.json({
                success: false,
                message: `Không tìm thấy bàn ${tableId}`
            });
        }

        const lastDataKey = `table_${tableId}`;
        const oldData = lastData[lastDataKey] || '';
        const isNewData = (history !== oldData && history.length > oldData.length);
        lastData[lastDataKey] = history;

        if (!sessionData[tableId]) sessionData[tableId] = 0;
        if (isNewData) sessionData[tableId]++;

        const result = predictBCR(history);

        // Tính đúng/sai
        let correct = 0;
        let wrong = 0;
        if (history.length > 1) {
            const lastActual = history[history.length - 1];
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

        // ===== JSON GỌN =====
        res.json({
            success: true,
            bàn: `Bàn ${tableId}`,
            phiên: sessionData[tableId],
            cầu_gốc: result.cau_goc,
            dự_đoán: result.prediction,
            tỉ_lệ: `${Math.max(result.banker, result.player, result.tie)}%`,
            đúng: historyCorrect[tableId] ? historyCorrect[tableId].correct : 0,
            sai: historyCorrect[tableId] ? historyCorrect[tableId].wrong : 0,
            tỉ_lệ_thắng_bàn: `${winRate}%`,
            id: '@tranhoang2286'
        });

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
            const history = await fetchTableData(id);
            if (history) {
                const lastDataKey = `table_${id}`;
                const oldData = lastData[lastDataKey] || '';
                const isNewData = (history !== oldData && history.length > oldData.length);
                lastData[lastDataKey] = history;

                if (!sessionData[id]) sessionData[id] = 0;
                if (isNewData) sessionData[id]++;

                const result = predictBCR(history);

                let correct = 0;
                let wrong = 0;
                if (history.length > 1) {
                    const lastActual = history[history.length - 1];
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
                    cầu_gốc: result.cau_goc,
                    dự_đoán: result.prediction,
                    tỉ_lệ: `${Math.max(result.banker, result.player, result.tie)}%`,
                    đúng: historyCorrect[id] ? historyCorrect[id].correct : 0,
                    sai: historyCorrect[id] ? historyCorrect[id].wrong : 0,
                    tỉ_lệ_thắng_bàn: `${winRate}%`
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
        name: 'BACCARAT PREDICTION - SIÊU CẦU',
        version: '7.0.0',
        author: '@tranhoang2286',
        features: {
            cầu_gốc: 'Hiển thị chuỗi kết quả thực tế',
            dự_đoán: 'Dựa trên 21 thuật toán',
            không_random: '100% không random'
        },
        algorithms: [
            'Frequency', 'Streak', 'Zigzag',
            'Pattern 2-2', 'Pattern 3-3', 'Pattern 4-4',
            'Pattern 1-2-3', 'Pattern 2-1-2',
            'Markov 1', 'Markov 2',
            'Momentum', 'Entropy', 'Gap',
            'Fibonacci', 'Harmonic', 'Correlation',
            'Support/Resistance', 'Pivot', 'Trendline',
            'Volatility', 'Pattern Recognition'
        ],
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
    console.log('🃏 BACCARAT PREDICTION - SIÊU CẦU');
    console.log('========================================');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log('📌 21 thuật toán con');
    console.log('📌 All cầu BCR');
    console.log('📌 Không random');
    console.log(`👤 Author: @tranhoang2286`);
    console.log('========================================');
});
