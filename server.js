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
const historyCorrect = {};
const predictionHistory = {};

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
        // Chuẩn hóa tên bàn: C01, C02, ...
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
// THUẬT TOÁN DỰ ĐOÁN - KHÔNG RANDOM
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
    const total = arr.length;

    // ===== 1. TẦN SUẤT =====
    const counts = { B: 0, P: 0, T: 0 };
    for (const c of arr) {
        if (counts[c] !== undefined) counts[c]++;
    }
    const bPercent = (counts.B / total) * 100;
    const pPercent = (counts.P / total) * 100;
    const tPercent = (counts.T / total) * 100;

    // ===== 2. STREAK (DÂY) =====
    let maxStreak = 1;
    let streakChar = arr[0];
    let currentStreak = 1;
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === arr[i-1]) {
            currentStreak++;
            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
                streakChar = arr[i];
            }
        } else {
            currentStreak = 1;
        }
    }

    // ===== 3. ZIGZAG (ĐAN XEN) =====
    let zigzagCount = 0;
    for (let i = 1; i < arr.length - 1; i++) {
        if (arr[i] !== arr[i-1] && arr[i] !== arr[i+1]) {
            zigzagCount++;
        }
    }

    // ===== 4. PATTERN 2-2 =====
    let pattern22 = 0;
    let pattern22Char = '';
    for (let i = 1; i < Math.min(10, arr.length - 1); i += 2) {
        if (arr[arr.length - i] === arr[arr.length - i - 1]) {
            pattern22++;
            pattern22Char = arr[arr.length - i];
        }
    }

    // ===== 5. PATTERN 3-3 =====
    let pattern33 = 0;
    let pattern33Char = '';
    for (let i = 2; i < Math.min(12, arr.length - 1); i += 3) {
        if (arr[arr.length - i] === arr[arr.length - i - 1] &&
            arr[arr.length - i] === arr[arr.length - i - 2]) {
            pattern33++;
            pattern33Char = arr[arr.length - i];
        }
    }

    // ===== 6. MARKOV BẬC 1 =====
    const markov = { 'B': { 'B': 0, 'P': 0, 'T': 0 }, 'P': { 'B': 0, 'P': 0, 'T': 0 }, 'T': { 'B': 0, 'P': 0, 'T': 0 } };
    for (let i = 0; i < arr.length - 1; i++) {
        if (markov[arr[i]] && markov[arr[i]][arr[i+1]] !== undefined) {
            markov[arr[i]][arr[i+1]]++;
        }
    }
    const lastChar = arr[arr.length - 1];
    const trans = markov[lastChar];
    let markovPred = 'B';
    let markovProb = 0;
    if (trans) {
        const totalTrans = trans.B + trans.P + trans.T;
        if (totalTrans > 0) {
            let maxProb = 0;
            for (const [key, val] of Object.entries(trans)) {
                if (val / totalTrans > maxProb) {
                    maxProb = val / totalTrans;
                    markovPred = key;
                    markovProb = maxProb;
                }
            }
        }
    }

    // ===== 7. MOMENTUM =====
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    let momentum = 0;
    for (let i = 1; i < Math.min(values.length, 10); i++) {
        momentum += values[i] - values[i - 1];
    }

    // ===== 8. ENTROPY =====
    let entropy = 0;
    for (const c of ['B', 'P', 'T']) {
        const prob = counts[c] / total;
        if (prob > 0) entropy -= prob * Math.log2(prob);
    }
    const maxEntropy = Math.log2(3);
    const predictability = 1 - (entropy / maxEntropy);

    // ===== 9. GAP TIE =====
    const tiePositions = [];
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === 'T') tiePositions.push(i);
    }
    let tieGap = Infinity;
    let tieFrequency = 0;
    let tieSignal = false;
    let tieScore = 0;

    if (tiePositions.length > 0) {
        let totalGap = 0;
        for (let i = 1; i < tiePositions.length; i++) {
            totalGap += tiePositions[i] - tiePositions[i-1];
        }
        tieGap = tiePositions.length > 1 ? totalGap / (tiePositions.length - 1) : arr.length;
        tieFrequency = (tiePositions.length / arr.length) * 100;
        
        // Phát hiện Tie sắp xuất hiện
        const lastTiePos = tiePositions[tiePositions.length - 1];
        const currentGap = arr.length - 1 - lastTiePos;
        if (currentGap >= tieGap * 0.8) {
            tieSignal = true;
            tieScore += 40;
        }
    }
    if (tieFrequency > 10) {
        tieSignal = true;
        tieScore += 30;
    }

    // ===== 10. PHÂN TÍCH 5 KẾT QUẢ GẦN NHẤT =====
    const last5 = arr.slice(-5);
    const b5 = last5.filter(c => c === 'B').length;
    const p5 = last5.filter(c => c === 'P').length;
    const t5 = last5.filter(c => c === 'T').length;

    // ============================================================
    // TÍNH ĐIỂM
    // ============================================================
    let bankerScore = 0;
    let playerScore = 0;
    let tieScoreFinal = 0;

    const weights = {
        frequency: 0.18,
        streak: 0.20,
        zigzag: 0.12,
        pattern22: 0.10,
        pattern33: 0.08,
        markov: 0.10,
        momentum: 0.08,
        entropy: 0.04,
        last5: 0.04,
        tie: 0.06
    };

    // 1. Frequency
    const realProb = { B: 45.86, P: 44.62, T: 9.52 };
    const freqB = (bPercent * 0.5) + (realProb.B * 0.5);
    const freqP = (pPercent * 0.5) + (realProb.P * 0.5);
    const freqT = (tPercent * 0.5) + (realProb.T * 0.5);

    bankerScore += freqB * weights.frequency;
    playerScore += freqP * weights.frequency;
    tieScoreFinal += freqT * weights.frequency;

    // 2. Streak
    if (maxStreak >= 4) {
        const reverse = streakChar === 'B' ? 'P' : streakChar === 'P' ? 'B' : 'T';
        if (reverse === 'B') bankerScore += 100 * weights.streak;
        else if (reverse === 'P') playerScore += 100 * weights.streak;
        else tieScoreFinal += 100 * weights.streak;
    } else if (maxStreak >= 2) {
        if (streakChar === 'B') bankerScore += 80 * weights.streak;
        else if (streakChar === 'P') playerScore += 80 * weights.streak;
        else tieScoreFinal += 80 * weights.streak;
    } else {
        bankerScore += 50 * weights.streak;
        playerScore += 50 * weights.streak;
        tieScoreFinal += 20 * weights.streak;
    }

    // 3. Zigzag
    if (zigzagCount >= 4) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 100 * weights.zigzag;
        else if (last === 'B') playerScore += 100 * weights.zigzag;
        else tieScoreFinal += 100 * weights.zigzag;
    } else if (zigzagCount >= 2) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 70 * weights.zigzag;
        else if (last === 'B') playerScore += 70 * weights.zigzag;
        else tieScoreFinal += 70 * weights.zigzag;
    } else {
        bankerScore += 50 * weights.zigzag;
        playerScore += 50 * weights.zigzag;
        tieScoreFinal += 20 * weights.zigzag;
    }

    // 4. Pattern 2-2
    if (pattern22 >= 2) {
        const reverse = pattern22Char === 'B' ? 'P' : pattern22Char === 'P' ? 'B' : 'T';
        if (reverse === 'B') bankerScore += 100 * weights.pattern22;
        else if (reverse === 'P') playerScore += 100 * weights.pattern22;
        else tieScoreFinal += 100 * weights.pattern22;
    } else if (pattern22 >= 1) {
        const last = arr[arr.length - 1];
        if (last === 'B') bankerScore += 70 * weights.pattern22;
        else if (last === 'P') playerScore += 70 * weights.pattern22;
        else tieScoreFinal += 70 * weights.pattern22;
    } else {
        bankerScore += 50 * weights.pattern22;
        playerScore += 50 * weights.pattern22;
    }

    // 5. Pattern 3-3
    if (pattern33 >= 1) {
        const reverse = pattern33Char === 'B' ? 'P' : pattern33Char === 'P' ? 'B' : 'T';
        if (reverse === 'B') bankerScore += 100 * weights.pattern33;
        else if (reverse === 'P') playerScore += 100 * weights.pattern33;
        else tieScoreFinal += 100 * weights.pattern33;
    } else {
        bankerScore += 50 * weights.pattern33;
        playerScore += 50 * weights.pattern33;
    }

    // 6. Markov
    if (markovProb > 0.4) {
        if (markovPred === 'B') bankerScore += 100 * weights.markov;
        else if (markovPred === 'P') playerScore += 100 * weights.markov;
        else tieScoreFinal += 100 * weights.markov;
    } else {
        bankerScore += 50 * weights.markov;
        playerScore += 50 * weights.markov;
        tieScoreFinal += 20 * weights.markov;
    }

    // 7. Momentum
    if (Math.abs(momentum) > 1.5) {
        if (momentum > 0) bankerScore += 100 * weights.momentum;
        else playerScore += 100 * weights.momentum;
    } else {
        bankerScore += 50 * weights.momentum;
        playerScore += 50 * weights.momentum;
    }

    // 8. Entropy
    if (predictability > 0.6) {
        const freqPred = bPercent > pPercent ? 'B' : 'P';
        if (freqPred === 'B') bankerScore += 100 * weights.entropy;
        else playerScore += 100 * weights.entropy;
    } else if (predictability < 0.3) {
        tieScoreFinal += 100 * weights.entropy;
    } else {
        bankerScore += 50 * weights.entropy;
        playerScore += 50 * weights.entropy;
    }

    // 9. Last 5
    if (b5 > p5 && b5 > t5) {
        if (b5 >= 4) {
            playerScore += 100 * weights.last5;
        } else {
            bankerScore += 70 * weights.last5;
            playerScore += 30 * weights.last5;
        }
    } else if (p5 > b5 && p5 > t5) {
        if (p5 >= 4) {
            bankerScore += 100 * weights.last5;
        } else {
            playerScore += 70 * weights.last5;
            bankerScore += 30 * weights.last5;
        }
    } else if (t5 > b5 && t5 > p5) {
        tieScoreFinal += 100 * weights.last5;
    } else {
        bankerScore += 50 * weights.last5;
        playerScore += 50 * weights.last5;
    }

    // 10. Tie Signal
    if (tieSignal) {
        tieScoreFinal += tieScore * weights.tie;
        // Nếu tie score cao, ưu tiên Tie
        if (tieScoreFinal > bankerScore && tieScoreFinal > playerScore) {
            tieScoreFinal += 20;
        }
    }

    // ============================================================
    // CHUẨN HÓA
    // ============================================================
    const totalScore = bankerScore + playerScore + tieScoreFinal || 1;
    let bankerRate = (bankerScore / totalScore) * 100;
    let playerRate = (playerScore / totalScore) * 100;
    let tieRate = (tieScoreFinal / totalScore) * 100;

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
    
    // Nếu Tie có tín hiệu và tỉ lệ cao, ưu tiên Tie
    if (tieSignal && tieRate > 25 && tieRate > bankerRate && tieRate > playerRate) {
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
    if (tieSignal && t > 25) {
        confidence = Math.min(confidence + 5, 95);
    }
    confidence = Math.max(55, Math.min(confidence, 95));

    // ============================================================
    // PHÂN TÍCH CẦU
    // ============================================================
    let patternDesc = 'Cầu đan xen';
    if (prediction === 'Tie' && tieSignal) {
        patternDesc = `🔮 TIE SIGNAL! Cách ${Math.round(tieGap)} ván, Tần suất ${Math.round(tieFrequency)}%`;
    } else if (maxStreak >= 4) {
        patternDesc = `Dây ${streakChar} x${maxStreak} - Sắp đảo chiều`;
    } else if (zigzagCount >= 4) {
        patternDesc = `Zigzag ${zigzagCount} lần`;
    } else if (pattern22 >= 2) {
        patternDesc = `Cầu 2-2 (${pattern22} lần)`;
    } else if (pattern33 >= 1) {
        patternDesc = `Cầu 3-3`;
    } else if (bPercent > 55) {
        patternDesc = `Banker áp đảo ${Math.round(bPercent)}%`;
    } else if (pPercent > 55) {
        patternDesc = `Player áp đảo ${Math.round(pPercent)}%`;
    } else if (tPercent > 10) {
        patternDesc = `Tie xuất hiện nhiều ${Math.round(tPercent)}%`;
    }

    const algorithms = {
        frequency: { B: Math.round(bPercent), P: Math.round(pPercent), T: Math.round(tPercent) },
        streak: { char: streakChar, max: maxStreak },
        zigzag: { count: zigzagCount },
        pattern22: { count: pattern22 },
        pattern33: { count: pattern33 },
        markov: { pred: markovPred, prob: Math.round(markovProb * 100) },
        momentum: { value: Math.round(momentum * 100) / 100 },
        entropy: { value: Math.round(entropy * 10) / 10, predictability: Math.round(predictability * 100) },
        tie: { signal: tieSignal, score: Math.round(tieScore), gap: Math.round(tieGap) }
    };

    return {
        prediction: prediction,
        bankerRate: Math.max(b, 3),
        playerRate: Math.max(p, 3),
        tieRate: Math.max(t, 2),
        pattern: patternDesc,
        cau_goc: history,
        confidence: confidence,
        tie_signal: tieSignal,
        tie_score: Math.round(tieScore),
        stats: {
            B: Math.round(bPercent),
            P: Math.round(pPercent),
            T: Math.round(tPercent),
            maxStreak: maxStreak,
            zigzag: zigzagCount,
            pattern22: pattern22,
            pattern33: pattern33,
            tieGap: Math.round(tieGap),
            tieFrequency: Math.round(tieFrequency),
            momentum: Math.round(momentum * 100) / 100,
            entropy: Math.round(entropy * 10) / 10,
            predictability: Math.round(predictability * 100)
        },
        algorithms: algorithms
    };
}

// ============================================================
// API DỰ ĐOÁN TỪNG BÀN
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

        // ============================================================
        // XÁC ĐỊNH LOẠI DỰ ĐOÁN ĐỂ HIỂN THỊ ĐÚNG FORMAT
        // ============================================================
        let responseData = {
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
            const cauGoc = await fetchTableData(id);
            if (cauGoc) {
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
                    tie_signal: result.tie_signal
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
// API PROXY - LẤY DỮ LIỆU GỐC
// ============================================================
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
        name: 'BACCARAT PREDICTION - SIÊU MẠNH V8.0',
        version: '8.0.0',
        author: '@tranhoang2286',
        api_source: API_BASE,
        features: {
            dự_đoán: '3 cửa Banker, Player, Tie',
            tỉ_lệ: 'Mỗi tỉ lệ riêng biệt',
            tie_signal: 'Phát hiện Tie sắp xuất hiện',
            không_random: '100% không random'
        },
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all',
            'Lấy dữ liệu bàn': '/api/baccarat/:tableId'
        },
        note: 'Không phân biệt chữ hoa/thường, tự động chuyển về chữ hoa'
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
    console.log(`📡 API Source: ${API_BASE}`);
    console.log('📌 Không phân biệt chữ hoa/thường');
    console.log('📌 10 phương pháp phân tích');
    console.log('📌 Dự đoán: Banker | Player | Tie');
    console.log(`👤 Author: @tranhoang2286`);
    console.log('========================================');
});
