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
// HÀM TÍNH TỈ LỆ TIE - ĐỘC LẬP
// ============================================================
function calculateTieRate(history) {
    if (!history || history.length < 5) return { rate: 5, signal: false };
    
    const arr = toArray(history);
    const tiePositions = [];
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === 'T') tiePositions.push(i);
    }
    
    let rate = (tiePositions.length / arr.length) * 100;
    let signal = false;
    let gap = Infinity;
    
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
        }
    }
    
    const recent20 = arr.slice(-20);
    const tieInRecent = recent20.filter(c => c === 'T').length;
    if (tieInRecent === 0 && arr.length > 20) {
        signal = true;
    }
    
    let finalRate = Math.min(rate + 5, 35);
    if (signal) {
        finalRate = Math.min(finalRate + 10, 45);
    }
    if (tieInRecent >= 2) {
        finalRate = Math.min(finalRate + 5, 30);
    }
    
    return {
        rate: Math.max(Math.round(finalRate), 3),
        signal: signal,
        gap: Math.round(gap)
    };
}

// ============================================================
// THUẬT TOÁN DỰ ĐOÁN CHÍNH (B hoặc P)
// ============================================================
function predictMain(history) {
    if (!history || history.length < 3) {
        return { prediction: 'Player', rate: 48, pattern: 'Chưa đủ dữ liệu' };
    }

    const arr = toArray(history);
    const total = arr.length;

    const counts = { B: 0, P: 0, T: 0 };
    for (const c of arr) {
        if (counts[c] !== undefined) counts[c]++;
    }
    const bPercent = (counts.B / total) * 100;
    const pPercent = (counts.P / total) * 100;

    // Streak
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

    // Zigzag
    let zigzagCount = 0;
    for (let i = 1; i < arr.length - 1; i++) {
        if (arr[i] !== arr[i-1] && arr[i] !== arr[i+1]) {
            zigzagCount++;
        }
    }

    // Pattern 2-2
    let pattern22 = 0;
    let pattern22Char = '';
    for (let i = 1; i < Math.min(10, arr.length - 1); i += 2) {
        if (arr[arr.length - i] === arr[arr.length - i - 1]) {
            pattern22++;
            pattern22Char = arr[arr.length - i];
        }
    }

    // Pattern 3-3
    let pattern33 = 0;
    let pattern33Char = '';
    for (let i = 2; i < Math.min(12, arr.length - 1); i += 3) {
        if (arr[arr.length - i] === arr[arr.length - i - 1] &&
            arr[arr.length - i] === arr[arr.length - i - 2]) {
            pattern33++;
            pattern33Char = arr[arr.length - i];
        }
    }

    // Markov
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

    // Momentum
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    let momentum = 0;
    for (let i = 1; i < Math.min(values.length, 10); i++) {
        momentum += values[i] - values[i - 1];
    }

    // ===== TÍNH ĐIỂM =====
    let bankerScore = 0;
    let playerScore = 0;

    const weights = {
        frequency: 0.22,
        streak: 0.25,
        zigzag: 0.13,
        pattern22: 0.10,
        pattern33: 0.08,
        markov: 0.12,
        momentum: 0.10
    };

    // Frequency
    const realProb = { B: 45.86, P: 44.62 };
    const freqB = (bPercent * 0.5) + (realProb.B * 0.5);
    const freqP = (pPercent * 0.5) + (realProb.P * 0.5);

    bankerScore += freqB * weights.frequency;
    playerScore += freqP * weights.frequency;

    // Streak
    if (maxStreak >= 4) {
        const reverse = streakChar === 'B' ? 'P' : 'B';
        if (reverse === 'B') bankerScore += 100 * weights.streak;
        else playerScore += 100 * weights.streak;
    } else if (maxStreak >= 2) {
        if (streakChar === 'B') bankerScore += 80 * weights.streak;
        else if (streakChar === 'P') playerScore += 80 * weights.streak;
        else {
            bankerScore += 50 * weights.streak;
            playerScore += 50 * weights.streak;
        }
    } else {
        bankerScore += 50 * weights.streak;
        playerScore += 50 * weights.streak;
    }

    // Zigzag
    if (zigzagCount >= 4) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 100 * weights.zigzag;
        else if (last === 'B') playerScore += 100 * weights.zigzag;
        else {
            bankerScore += 50 * weights.zigzag;
            playerScore += 50 * weights.zigzag;
        }
    } else if (zigzagCount >= 2) {
        const last = arr[arr.length - 1];
        if (last === 'P') bankerScore += 70 * weights.zigzag;
        else if (last === 'B') playerScore += 70 * weights.zigzag;
        else {
            bankerScore += 50 * weights.zigzag;
            playerScore += 50 * weights.zigzag;
        }
    } else {
        bankerScore += 50 * weights.zigzag;
        playerScore += 50 * weights.zigzag;
    }

    // Pattern 2-2
    if (pattern22 >= 2) {
        const reverse = pattern22Char === 'B' ? 'P' : 'B';
        if (reverse === 'B') bankerScore += 100 * weights.pattern22;
        else playerScore += 100 * weights.pattern22;
    } else if (pattern22 >= 1) {
        const last = arr[arr.length - 1];
        if (last === 'B') bankerScore += 70 * weights.pattern22;
        else if (last === 'P') playerScore += 70 * weights.pattern22;
        else {
            bankerScore += 50 * weights.pattern22;
            playerScore += 50 * weights.pattern22;
        }
    } else {
        bankerScore += 50 * weights.pattern22;
        playerScore += 50 * weights.pattern22;
    }

    // Pattern 3-3
    if (pattern33 >= 1) {
        const reverse = pattern33Char === 'B' ? 'P' : 'B';
        if (reverse === 'B') bankerScore += 100 * weights.pattern33;
        else playerScore += 100 * weights.pattern33;
    } else {
        bankerScore += 50 * weights.pattern33;
        playerScore += 50 * weights.pattern33;
    }

    // Markov
    if (markovProb > 0.4) {
        if (markovPred === 'B') bankerScore += 100 * weights.markov;
        else if (markovPred === 'P') playerScore += 100 * weights.markov;
        else {
            bankerScore += 50 * weights.markov;
            playerScore += 50 * weights.markov;
        }
    } else {
        bankerScore += 50 * weights.markov;
        playerScore += 50 * weights.markov;
    }

    // Momentum
    if (Math.abs(momentum) > 1.5) {
        if (momentum > 0) bankerScore += 100 * weights.momentum;
        else playerScore += 100 * weights.momentum;
    } else {
        bankerScore += 50 * weights.momentum;
        playerScore += 50 * weights.momentum;
    }

    // ===== CHUẨN HÓA =====
    const totalScore = bankerScore + playerScore || 1;
    let bankerRate = (bankerScore / totalScore) * 100;
    let playerRate = (playerScore / totalScore) * 100;

    bankerRate = bankerRate * 0.7 + 13.76;
    playerRate = playerRate * 0.7 + 13.39;

    const sum = bankerRate + playerRate;
    bankerRate = (bankerRate / sum) * 100;
    playerRate = (playerRate / sum) * 100;

    // ===== DỰ ĐOÁN =====
    let prediction = 'Player';
    let rate = 0;
    if (bankerRate > playerRate) {
        prediction = 'Banker';
        rate = Math.round(bankerRate);
    } else {
        prediction = 'Player';
        rate = Math.round(playerRate);
    }

    if (rate === 50) rate = 51;
    if (rate > 75) rate = 74;
    if (rate < 48) rate = 49;

    // ===== PHÂN TÍCH CẦU =====
    let pattern = 'Cầu đan xen';
    if (maxStreak >= 4) {
        pattern = `Dây ${streakChar} x${maxStreak} - Sắp đảo chiều`;
    } else if (zigzagCount >= 4) {
        pattern = `Zigzag ${zigzagCount} lần`;
    } else if (pattern22 >= 2) {
        pattern = `Cầu 2-2 (${pattern22} lần)`;
    } else if (pattern33 >= 1) {
        pattern = `Cầu 3-3`;
    } else if (bPercent > 55) {
        pattern = `Banker áp đảo ${Math.round(bPercent)}%`;
    } else if (pPercent > 55) {
        pattern = `Player áp đảo ${Math.round(pPercent)}%`;
    }

    return {
        prediction: prediction,
        rate: rate,
        pattern: pattern
    };
}

// ============================================================
// API DỰ ĐOÁN TỪNG BÀN - GỌN KHÔNG ĐÚNG SAI
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

        const main = predictMain(cauGoc);
        const tie = calculateTieRate(cauGoc);

        // ===== JSON GỌN - KHÔNG ĐÚNG SAI =====
        res.json({
            success: true,
            bàn: `Bàn ${tableId}`,
            phiên: sessionData[tableId],
            cầu_gốc: cauGoc,
            dự_đoán: main.prediction,
            tỉ_lệ: `${main.rate}%`,
            dự_đoán_tie: tie.signal ? 'CÓ' : 'KHÔNG',
            tỉ_lệ_tie: `${tie.rate}%`,
            cầu: main.pattern,
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
            const cauGoc = await fetchTableData(id);
            if (cauGoc) {
                const oldData = lastData[id] || '';
                const isNewData = (cauGoc !== oldData && cauGoc.length > oldData.length);
                lastData[id] = cauGoc;

                if (!sessionData[id]) sessionData[id] = 0;
                if (isNewData) sessionData[id]++;

                const main = predictMain(cauGoc);
                const tie = calculateTieRate(cauGoc);

                results.push({
                    bàn: `Bàn ${id}`,
                    phiên: sessionData[id],
                    cầu_gốc: cauGoc,
                    dự_đoán: main.prediction,
                    tỉ_lệ: `${main.rate}%`,
                    dự_đoán_tie: tie.signal ? 'CÓ' : 'KHÔNG',
                    tỉ_lệ_tie: `${tie.rate}%`,
                    cầu: main.pattern
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
// API PROXY
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
        name: 'BACCARAT PREDICTION - GỌN NHẤT',
        version: '10.0.0',
        author: '@tranhoang2286',
        api_source: API_BASE,
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all',
            'Lấy dữ liệu bàn': '/api/baccarat/:tableId'
        },
        example: {
            url: '/api/predict/C02',
            response: {
                bàn: 'Bàn C02',
                phiên: 1,
                cầu_gốc: 'BBPPBBBBPPPPPPBBBTBBPPBPPTPPBBBBPPBBPBTPBBBBPBBBBPBTBTBPPBPBPBB',
                dự_đoán: 'Banker',
                tỉ_lệ: '62%',
                dự_đoán_tie: 'KHÔNG',
                tỉ_lệ_tie: '5%',
                cầu: 'Dây B x4 - Sắp đảo chiều'
            }
        }
    });
});

// ============================================================
// KHỞI ĐỘNG
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🃏 BACCARAT PREDICTION - GỌN NHẤT');
    console.log('========================================');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📡 API Source: ${API_BASE}`);
    console.log('📌 JSON: bàn, phiên, cầu_gốc, dự_đoán, tỉ_lệ, dự_đoán_tie, tỉ_lệ_tie, cầu');
    console.log('📌 Đã xóa đúng/sai');
    console.log(`👤 Author: @tranhoang2286`);
    console.log('========================================');
});
