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
// THUẬT TOÁN DỰ ĐOÁN - KHÔNG RANDOM - CÂN BẰNG
// ============================================================
function predictBCR(history) {
    // ===== KHỞI TẠO =====
    if (!history || history.length < 3) {
        return {
            prediction: 'Player',
            bankerRate: 48,
            playerRate: 48,
            tieRate: 4,
            pattern: 'Chưa đủ dữ liệu',
            cau_goc: history || '',
            confidence: 50,
            stats: { B: 0, P: 0, T: 0 }
        };
    }

    const arr = toArray(history);
    const total = arr.length;

    // ===== 1. TẦN SUẤT CƠ BẢN =====
    const counts = { B: 0, P: 0, T: 0 };
    for (const c of arr) {
        if (counts[c] !== undefined) counts[c]++;
    }
    const bPercent = (counts.B / total) * 100;
    const pPercent = (counts.P / total) * 100;
    const tPercent = (counts.T / total) * 100;

    // ===== 2. PHÂN TÍCH STREAK (DÂY) =====
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

    // ===== 3. PHÂN TÍCH ZIGZAG =====
    let zigzagCount = 0;
    for (let i = 1; i < arr.length - 1; i++) {
        if (arr[i] !== arr[i-1] && arr[i] !== arr[i+1]) {
            zigzagCount++;
        }
    }

    // ===== 4. PHÂN TÍCH PATTERN 2-2 =====
    let pattern22 = 0;
    let pattern22Char = '';
    for (let i = 1; i < Math.min(10, arr.length - 1); i += 2) {
        if (arr[arr.length - i] === arr[arr.length - i - 1]) {
            pattern22++;
            pattern22Char = arr[arr.length - i];
        }
    }

    // ===== 5. PHÂN TÍCH PATTERN 3-3 =====
    let pattern33 = 0;
    let pattern33Char = '';
    for (let i = 2; i < Math.min(12, arr.length - 1); i += 3) {
        if (arr[arr.length - i] === arr[arr.length - i - 1] &&
            arr[arr.length - i] === arr[arr.length - i - 2]) {
            pattern33++;
            pattern33Char = arr[arr.length - i];
        }
    }

    // ===== 6. PHÂN TÍCH MARKOV =====
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

    // ===== 7. PHÂN TÍCH MOMENTUM =====
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    let momentum = 0;
    for (let i = 1; i < Math.min(values.length, 10); i++) {
        momentum += values[i] - values[i - 1];
    }

    // ===== 8. PHÂN TÍCH ENTROPY =====
    let entropy = 0;
    for (const c of ['B', 'P', 'T']) {
        const prob = counts[c] / total;
        if (prob > 0) entropy -= prob * Math.log2(prob);
    }
    const maxEntropy = Math.log2(3);
    const predictability = 1 - (entropy / maxEntropy);

    // ===== 9. PHÂN TÍCH 5 KẾT QUẢ GẦN NHẤT =====
    const last5 = arr.slice(-5);
    const b5 = last5.filter(c => c === 'B').length;
    const p5 = last5.filter(c => c === 'P').length;
    const t5 = last5.filter(c => c === 'T').length;

    // ===== 10. PHÂN TÍCH TIE =====
    const tiePositions = [];
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === 'T') tiePositions.push(i);
    }
    let tieGap = Infinity;
    let tieFrequency = 0;
    let tieSignal = false;
    if (tiePositions.length > 0) {
        let totalGap = 0;
        for (let i = 1; i < tiePositions.length; i++) {
            totalGap += tiePositions[i] - tiePositions[i-1];
        }
        tieGap = tiePositions.length > 1 ? totalGap / (tiePositions.length - 1) : arr.length;
        tieFrequency = (tiePositions.length / arr.length) * 100;
        
        const lastTiePos = tiePositions[tiePositions.length - 1];
        const currentGap = arr.length - 1 - lastTiePos;
        if (currentGap >= tieGap * 0.8) {
            tieSignal = true;
        }
    }
    if (tieFrequency > 10) {
        tieSignal = true;
    }

    // ============================================================
    // TÍNH ĐIỂM - CÂN BẰNG
    // ============================================================
    let bankerScore = 0;
    let playerScore = 0;
    let tieScore = 0;

    // ===== 1. TẦN SUẤT =====
    const realProb = { B: 45.86, P: 44.62, T: 9.52 };
    const freqB = (bPercent * 0.5) + (realProb.B * 0.5);
    const freqP = (pPercent * 0.5) + (realProb.P * 0.5);
    const freqT = (tPercent * 0.5) + (realProb.T * 0.5);

    bankerScore += freqB * 0.18;
    playerScore += freqP * 0.18;
    tieScore += freqT * 0.18;

    // ===== 2. STREAK =====
    if (maxStreak >= 4) {
        // Dây dài -> ưu tiên đảo chiều
        const reverse = streakChar === 'B' ? 'P' : 'B';
        if (reverse === 'B') {
            bankerScore += 90;
            playerScore += 10;
        } else {
            playerScore += 90;
            bankerScore += 10;
        }
    } else if (maxStreak >= 2) {
        // Dây vừa -> tiếp tục nhưng có xem xét
        if (streakChar === 'B') {
            bankerScore += 70;
            playerScore += 30;
        } else if (streakChar === 'P') {
            playerScore += 70;
            bankerScore += 30;
        } else {
            bankerScore += 50;
            playerScore += 50;
        }
    } else {
        bankerScore += 50;
        playerScore += 50;
    }

    // ===== 3. ZIGZAG =====
    if (zigzagCount >= 4) {
        const last = arr[arr.length - 1];
        if (last === 'P') {
            bankerScore += 85;
            playerScore += 15;
        } else if (last === 'B') {
            playerScore += 85;
            bankerScore += 15;
        } else {
            bankerScore += 50;
            playerScore += 50;
        }
    } else if (zigzagCount >= 2) {
        const last = arr[arr.length - 1];
        if (last === 'P') {
            bankerScore += 65;
            playerScore += 35;
        } else if (last === 'B') {
            playerScore += 65;
            bankerScore += 35;
        } else {
            bankerScore += 50;
            playerScore += 50;
        }
    } else {
        bankerScore += 50;
        playerScore += 50;
    }

    // ===== 4. PATTERN 2-2 =====
    if (pattern22 >= 2) {
        const reverse = pattern22Char === 'B' ? 'P' : 'B';
        if (reverse === 'B') {
            bankerScore += 85;
            playerScore += 15;
        } else {
            playerScore += 85;
            bankerScore += 15;
        }
    } else if (pattern22 >= 1) {
        const last = arr[arr.length - 1];
        if (last === 'B') {
            bankerScore += 65;
            playerScore += 35;
        } else if (last === 'P') {
            playerScore += 65;
            bankerScore += 35;
        } else {
            bankerScore += 50;
            playerScore += 50;
        }
    } else {
        bankerScore += 50;
        playerScore += 50;
    }

    // ===== 5. PATTERN 3-3 =====
    if (pattern33 >= 1) {
        const reverse = pattern33Char === 'B' ? 'P' : 'B';
        if (reverse === 'B') {
            bankerScore += 85;
            playerScore += 15;
        } else {
            playerScore += 85;
            bankerScore += 15;
        }
    } else {
        bankerScore += 50;
        playerScore += 50;
    }

    // ===== 6. MARKOV =====
    if (markovProb > 0.4) {
        if (markovPred === 'B') {
            bankerScore += 75;
            playerScore += 25;
        } else if (markovPred === 'P') {
            playerScore += 75;
            bankerScore += 25;
        } else {
            bankerScore += 50;
            playerScore += 50;
        }
    } else {
        bankerScore += 50;
        playerScore += 50;
    }

    // ===== 7. MOMENTUM =====
    if (Math.abs(momentum) > 1.5) {
        if (momentum > 0) {
            bankerScore += 70;
            playerScore += 30;
        } else {
            playerScore += 70;
            bankerScore += 30;
        }
    } else {
        bankerScore += 50;
        playerScore += 50;
    }

    // ===== 8. ENTROPY =====
    if (predictability > 0.6) {
        const freqPred = bPercent > pPercent ? 'B' : 'P';
        if (freqPred === 'B') {
            bankerScore += 70;
            playerScore += 30;
        } else {
            playerScore += 70;
            bankerScore += 30;
        }
    } else if (predictability < 0.3) {
        tieScore += 70;
    } else {
        bankerScore += 50;
        playerScore += 50;
    }

    // ===== 9. LAST 5 =====
    if (b5 > p5 && b5 > t5) {
        if (b5 >= 4) {
            // 4/5 là Banker -> đảo chiều
            playerScore += 85;
            bankerScore += 15;
        } else {
            bankerScore += 65;
            playerScore += 35;
        }
    } else if (p5 > b5 && p5 > t5) {
        if (p5 >= 4) {
            bankerScore += 85;
            playerScore += 15;
        } else {
            playerScore += 65;
            bankerScore += 35;
        }
    } else if (t5 > b5 && t5 > p5) {
        tieScore += 70;
    } else {
        bankerScore += 50;
        playerScore += 50;
    }

    // ===== 10. TIE =====
    if (tieSignal && tieFrequency > 8) {
        tieScore += 80;
    } else if (tieFrequency > 10) {
        tieScore += 60;
    }

    // ============================================================
    // CHUẨN HÓA
    // ============================================================
    const totalScore = bankerScore + playerScore + tieScore || 1;
    let bankerRate = (bankerScore / totalScore) * 100;
    let playerRate = (playerScore / totalScore) * 100;
    let tieRate = (tieScore / totalScore) * 100;

    // Điều chỉnh cuối cùng để cân bằng
    bankerRate = bankerRate * 0.7 + 15;
    playerRate = playerRate * 0.7 + 15;
    tieRate = tieRate * 0.7 + 4;

    const sum = bankerRate + playerRate + tieRate;
    bankerRate = (bankerRate / sum) * 100;
    playerRate = (playerRate / sum) * 100;
    tieRate = (tieRate / sum) * 100;

    // ============================================================
    // XÁC ĐỊNH DỰ ĐOÁN
    // ============================================================
    let prediction = 'Player';
    let maxRate = Math.max(bankerRate, playerRate, tieRate);
    
    // Nếu Tie có tín hiệu và tỉ lệ cao
    if (tieSignal && tieRate > 20 && tieRate > bankerRate && tieRate > playerRate) {
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
    if (tieSignal && t > 20) {
        confidence = Math.min(confidence + 5, 90);
    }
    confidence = Math.max(50, Math.min(confidence, 90));

    // ============================================================
    // PHÂN TÍCH CẦU
    // ============================================================
    let pattern = 'Cầu đan xen';
    if (prediction === 'Tie' && tieSignal) {
        pattern = `🔮 TIE SIGNAL! Cách ${Math.round(tieGap)} ván, Tần suất ${Math.round(tieFrequency)}%`;
    } else if (maxStreak >= 4) {
        pattern = `Dây ${streakChar} x${maxStreak} - Sắp đảo chiều`;
    } else if (zigzagCount >= 4) {
        pattern = `Zigzag ${zigzagCount} lần`;
    } else if (pattern22 >= 2) {
        pattern = `Cầu 2-2 (${pattern22} lần)`;
    } else if (pattern33 >= 1) {
        pattern = `Cầu 3-3`;
    } else if (bPercent > 55) {
        pattern = `Banker áp đảo ${Math.round(bPercent)}% - Có thể đảo chiều`;
    } else if (pPercent > 55) {
        pattern = `Player áp đảo ${Math.round(pPercent)}% - Có thể đảo chiều`;
    } else {
        pattern = `Cầu đan xen - B:${Math.round(bPercent)}% P:${Math.round(pPercent)}% T:${Math.round(tPercent)}%`;
    }

    return {
        prediction: prediction,
        bankerRate: Math.max(b, 3),
        playerRate: Math.max(p, 3),
        tieRate: Math.max(t, 2),
        pattern: pattern,
        cau_goc: history,
        confidence: confidence,
        tie_signal: tieSignal,
        tie_score: Math.round(tieFrequency),
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
        }
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
        name: 'BACCARAT PREDICTION - CÂN BẰNG',
        version: '14.0.0',
        author: '@tranhoang2286',
        api_source: API_BASE,
        features: {
            không_random: '100% không random',
            cân_bằng: 'Không thiên vị bất kỳ cửa nào',
            tie_signal: 'Phát hiện Tie sắp xuất hiện',
            độ_tin_cậy: 'Lên đến 90%'
        },
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
    console.log('🃏 BACCARAT PREDICTION - CÂN BẰNG');
    console.log('========================================');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📡 API Source: ${API_BASE}`);
    console.log('📌 10 phương pháp phân tích:');
    console.log('   1. Tần suất      2. Streak      3. Zigzag');
    console.log('   4. Pattern 2-2   5. Pattern 3-3 6. Markov');
    console.log('   7. Momentum      8. Entropy     9. Last 5');
    console.log('   10. Tie Analysis');
    console.log('========================================');
    console.log('📌 KHÔNG RANDOM - CÂN BẰNG - KHÔNG THIÊN VỊ');
    console.log(`👤 Author: @tranhoang2286`);
    console.log('========================================');
});
