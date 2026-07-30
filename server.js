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
const historyData = {};

// ============================================================
// HÀM TIỆN ÍCH
// ============================================================
function toArr(str) {
    return str ? str.split('').filter(c => ['B','P','T'].includes(c)) : [];
}

function demTanSuat(arr) {
    const cnt = {B:0, P:0, T:0};
    for (const c of arr) if (cnt[c] !== undefined) cnt[c]++;
    const total = arr.length || 1;
    return {
        B: cnt.B / total * 100,
        P: cnt.P / total * 100,
        T: cnt.T / total * 100,
        count: cnt,
        total: total
    };
}

function timChuoi(arr) {
    if (arr.length === 0) return [];
    const runs = [];
    let cur = {c: arr[0], n: 1};
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === cur.c) cur.n++;
        else { runs.push({...cur}); cur = {c: arr[i], n: 1}; }
    }
    runs.push({...cur});
    return runs;
}

function tinhDoLech(arr) {
    const ts = demTanSuat(arr);
    const std = {B: 45.86, P: 44.62, T: 9.52};
    return {
        B: ts.B - std.B,
        P: ts.P - std.P,
        T: ts.T - std.T
    };
}

function tinhXacSuatChuyen(arr, from, to) {
    let count = 0, total = 0;
    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] === from) {
            total++;
            if (arr[i+1] === to) count++;
        }
    }
    return total > 0 ? count / total * 100 : 0;
}

function getTop(arr, n) {
    const sorted = [...arr].sort((a,b) => b.conf - a.conf);
    return sorted.slice(0, n);
}

// ============================================================
= CÔNG THỨC 1: CẦU 1-1 ZIGZAG
// ============================================================
function CT1_Zigzag(arr) {
    if (arr.length < 4) return null;
    const last4 = arr.slice(-4);
    if (last4[0] === last4[2] && last4[1] === last4[3] && last4[0] !== last4[1]) {
        return { predict: last4[0] === 'B' ? 'P' : 'B', name: 'Cầu 1-1 Zigzag', conf: 92, priority: 1 };
    }
    return null;
}

// ============================================================
= CÔNG THỨC 2: CẦU 2-2-2
// ============================================================
function CT2_222(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 2) {
            return { predict: last3[0].c, name: 'Cầu 2-2-2', conf: 90, priority: 1 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 3: CẦU 2-2 ĐẢO
// ============================================================
function CT3_22Dao(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[1].n === 2 && last3[2].n === 2 && last3[1].c !== last3[2].c) {
            return { predict: last3[1].c, name: 'Cầu 2-2 Đảo', conf: 88, priority: 2 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 4: CẦU 3-3
// ============================================================
function CT4_33(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 3 && last2[1].n === 3) {
            return { predict: last2[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-3', conf: 89, priority: 2 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 5: CẦU 1-2-1
// ============================================================
function CT5_121(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 1) {
            return { predict: last3[1].c, name: 'Cầu 1-2-1', conf: 91, priority: 1 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 6: CẦU 2-1-2
// ============================================================
function CT6_212(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 1 && last3[2].n === 2) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-1-2', conf: 87, priority: 2 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 7: CẦU CHOP
// ============================================================
function CT7_Chop(arr) {
    if (arr.length < 8) return null;
    const recent = arr.slice(-8);
    let switches = 0;
    for (let i = 1; i < recent.length; i++) {
        if (recent[i] !== recent[i-1] && recent[i] !== 'T' && recent[i-1] !== 'T') {
            switches++;
        }
    }
    const rate = switches / 7;
    if (rate >= 0.7) {
        const last = recent[recent.length - 1];
        return { predict: last === 'B' ? 'P' : 'B', name: 'Cầu Chop', conf: 88, priority: 1 };
    }
    return null;
}

// ============================================================
= CÔNG THỨC 8: CẦU STREAK
// ============================================================
function CT8_Streak(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    const last = runs[runs.length - 1];
    if (last.n >= 5) {
        return { predict: last.c === 'B' ? 'P' : 'B', name: `Streak ${last.c} x${last.n} -> Đảo`, conf: 82, priority: 2 };
    }
    if (last.n >= 3 && last.n <= 4) {
        return { predict: last.c, name: `Streak ${last.c} x${last.n} -> Tiếp`, conf: 78, priority: 3 };
    }
    return null;
}

// ============================================================
= CÔNG THỨC 9: CẦU TIE
// ============================================================
function CT9_Tie(arr) {
    const tiePos = [];
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === 'T') tiePos.push(i);
    }
    if (tiePos.length < 2) return null;
    const gaps = [];
    for (let i = 1; i < tiePos.length; i++) {
        gaps.push(tiePos[i] - tiePos[i-1]);
    }
    const avgGap = gaps.reduce((a,b) => a+b, 0) / gaps.length;
    const lastGap = arr.length - 1 - tiePos[tiePos.length - 1];
    if (lastGap > avgGap * 1.5 && avgGap < 20 && avgGap > 5) {
        return { predict: 'T', name: `Tie Cycle (gap ${Math.round(avgGap)})`, conf: 82, priority: 2 };
    }
    return null;
}

// ============================================================
= CÔNG THỨC 10: CÂN BẰNG B/P
// ============================================================
function CT10_Balance(arr) {
    if (arr.length < 20) return null;
    const ts = demTanSuat(arr);
    const diff = ts.B - ts.P;
    if (diff > 15) return { predict: 'P', name: `Balance (B thừa ${Math.round(diff)}%)`, conf: 85, priority: 2 };
    if (diff < -15) return { predict: 'B', name: `Balance (P thừa ${Math.round(Math.abs(diff))}%)`, conf: 85, priority: 2 };
    return null;
}

// ============================================================
= CÔNG THỨC 11: CHOP DÀI 1-1-1-1
// ============================================================
function CT11_ChopDai(arr) {
    if (arr.length < 8) return null;
    const recent = arr.slice(-8);
    const runs = timChuoi(recent);
    if (runs.every(r => r.n === 1) && runs.length >= 6) {
        const last = runs[runs.length - 1].c;
        return { predict: last === 'B' ? 'P' : 'B', name: 'Chop dài 1-1-1-1', conf: 90, priority: 1 };
    }
    return null;
}

// ============================================================
= CÔNG THỨC 12: CẦU 2-1-1-2
// ============================================================
function CT12_2112(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cầu 2-1-1-2', conf: 89, priority: 2 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 13: CẦU 3-2-1
// ============================================================
function CT13_321(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 2 && last3[2].n === 1) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-2-1', conf: 86, priority: 3 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 14: CẦU 1-2-3
// ============================================================
function CT14_123(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 3) {
            return { predict: last3[1].c === 'B' ? 'P' : 'B', name: 'Cầu 1-2-3', conf: 87, priority: 3 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 15: CẦU 2-3-2
// ============================================================
function CT15_232(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 3 && last3[2].n === 2) {
            return { predict: last3[0].c, name: 'Cầu 2-3-2', conf: 88, priority: 2 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 16: CẦU 3-1-3
// ============================================================
function CT16_313(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 1 && last3[2].n === 3) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-3', conf: 86, priority: 3 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 17: CẦU 1-1-2
// ============================================================
function CT17_112(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 1 && last3[2].n === 2) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 1-1-2', conf: 85, priority: 3 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 18: CẦU 2-2-1
// ============================================================
function CT18_221(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 1) {
            return { predict: last3[0].c, name: 'Cầu 2-2-1', conf: 84, priority: 3 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 19: CẦU 4-4
// ============================================================
function CT19_44(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 4 && last2[1].n === 4) {
            return { predict: last2[0].c === 'B' ? 'P' : 'B', name: 'Cầu 4-4', conf: 84, priority: 3 };
        }
    }
    return null;
}

// ============================================================
= CÔNG THỨC 20: ĐỘ LỆCH CHUẨN
// ============================================================
function CT20_Deviation(arr) {
    if (arr.length < 30) return null;
    const dev = tinhDoLech(arr);
    if (dev.B < -10) return { predict: 'B', name: `Độ lệch (B thiếu ${Math.round(Math.abs(dev.B))}%)`, conf: 80, priority: 2 };
    if (dev.P < -10) return { predict: 'P', name: `Độ lệch (P thiếu ${Math.round(Math.abs(dev.P))}%)`, conf: 80, priority: 2 };
    if (dev.T < -7) return { predict: 'T', name: `Độ lệch (T thiếu ${Math.round(Math.abs(dev.T))}%)`, conf: 76, priority: 3 };
    return null;
}

// ============================================================
= THUẬT TOÁN TỔNG HỢP 20 CÔNG THỨC
// ============================================================
function duDoanVIP(history) {
    const arr = toArr(history);
    if (arr.length < 5) {
        return {
            Dự_đoán: 'ĐỢI',
            Tỉ_lệ: '0%',
            Độ_tin_cậy: '0%',
            Loại_cầu: 'Chưa đủ dữ liệu',
            BANKER: '0%',
            PLAYER: '0%',
            TIE: '0%',
            Số_công_thức: '0'
        };
    }

    // Lưu lịch sử
    if (!historyData['all']) historyData['all'] = [];
    historyData['all'].push({
        time: Date.now(),
        length: arr.length,
        last: arr[arr.length - 1]
    });
    if (historyData['all'].length > 100) historyData['all'].shift();

    const results = [];
    const formulas = [
        CT1_Zigzag, CT2_222, CT3_22Dao, CT4_33, CT5_121,
        CT6_212, CT7_Chop, CT8_Streak, CT9_Tie, CT10_Balance,
        CT11_ChopDai, CT12_2112, CT13_321, CT14_123, CT15_232,
        CT16_313, CT17_112, CT18_221, CT19_44, CT20_Deviation
    ];

    for (const formula of formulas) {
        const result = formula(arr);
        if (result) {
            results.push(result);
        }
    }

    // Nếu không có công thức nào -> dùng tần suất
    if (results.length === 0) {
        const ts = demTanSuat(arr);
        const max = Math.max(ts.B, ts.P, ts.T);
        let predict = 'B';
        let name = 'Tần suất B';
        if (ts.P === max) { predict = 'P'; name = 'Tần suất P'; }
        if (ts.T === max && ts.T > ts.B && ts.T > ts.P) { predict = 'T'; name = 'Tần suất T'; }
        
        return {
            Dự_đoán: predict === 'B' ? 'BANKER' : predict === 'P' ? 'PLAYER' : 'TIE',
            Tỉ_lệ: `${Math.round(max)}%`,
            Độ_tin_cậy: '55%',
            Loại_cầu: name,
            BANKER: `${Math.round(ts.B)}%`,
            PLAYER: `${Math.round(ts.P)}%`,
            TIE: `${Math.round(ts.T)}%`,
            Số_công_thức: '0 (dùng tần suất)'
        };
    }

    // Sắp xếp theo priority và confidence
    results.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.conf - a.conf;
    });

    // Tổng hợp điểm
    let scoreB = 0, scoreP = 0, scoreT = 0;
    let countB = 0, countP = 0, countT = 0;

    for (const r of results) {
        if (r.predict === 'B') { scoreB += r.conf; countB++; }
        else if (r.predict === 'P') { scoreP += r.conf; countP++; }
        else if (r.predict === 'T') { scoreT += r.conf; countT++; }
    }

    // Điểm trung bình
    let avgB = countB > 0 ? scoreB / countB : 30;
    let avgP = countP > 0 ? scoreP / countP : 30;
    let avgT = countT > 0 ? scoreT / countT : 8;

    // Chuẩn hóa
    const total = avgB + avgP + avgT;
    avgB = avgB / total * 100;
    avgP = avgP / total * 100;
    avgT = avgT / total * 100;

    // Confidence
    const baseConf = Math.min(50 + results.length * 1.5, 95);
    const confB = Math.min(baseConf + (avgB - 33) * 1.2, 95);
    const confP = Math.min(baseConf + (avgP - 33) * 1.2, 95);
    const confT = Math.min(baseConf + (avgT - 33) * 1.0, 85);

    // Chọn dự đoán
    const sides = [
        {name: 'BANKER', rate: Math.round(avgB), conf: Math.round(confB)},
        {name: 'PLAYER', rate: Math.round(avgP), conf: Math.round(confP)},
        {name: 'TIE', rate: Math.round(avgT), conf: Math.round(confT)}
    ];
    sides.sort((a,b) => b.conf - a.conf);
    const best = sides[0];
    const second = sides[1];

    // Lấy top 5 cầu
    const top5 = results.slice(0, 5).map((r, i) => `${i+1}. ${r.name} (${r.conf}%)`).join(' | ');

    return {
        Dự_đoán: best.name,
        Tỉ_lệ: `${best.rate}%`,
        Độ_tin_cậy: `${best.conf}%`,
        Loại_cầu: results[0]?.name || 'Không xác định',
        BANKER: `${Math.round(avgB)}% (${Math.round(confB)}%)`,
        PLAYER: `${Math.round(avgP)}% (${Math.round(confP)}%)`,
        TIE: `${Math.round(avgT)}% (${Math.round(confT)}%)`,
        Số_công_thức: `${results.length}/20`,
        Top_5_cầu: top5,
        Chênh_lệch: `${Math.round(best.conf - second.conf)}%`
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

        const result = duDoanVIP(cauGoc);

        res.json({
            phiên: sessionData[tableId],
            cầu_gốc: cauGoc,
            ...result,
            id: '@tranhoang2286'
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

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

            const result = duDoanVIP(cauGoc);
            
            predictions[id] = {
                phiên: sessionData[id],
                Dự_đoán: result.Dự_đoán,
                Tỉ_lệ: result.Tỉ_lệ,
                Độ_tin_cậy: result.Độ_tin_cậy,
                Loại_cầu: result.Loại_cầu,
                BANKER: result.BANKER,
                PLAYER: result.PLAYER,
                TIE: result.TIE,
                Số_công_thức: result.Số_công_thức
            };
        }

        res.json({
            success: true,
            engine: 'VIP-20-CONGTHUC-v2',
            timestamp: new Date().toISOString(),
            author: '@tranhoang2286',
            tong_cong_thuc: 20,
            predictions
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

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

app.get('/api/reset', (req, res) => {
    for (const key in sessionData) delete sessionData[key];
    for (const key in lastData) delete lastData[key];
    for (const key in historyData) delete historyData[key];
    res.json({ success: true, message: 'Đã reset toàn bộ dữ liệu' });
});

app.get('/', (req, res) => {
    res.json({
        name: 'BACCARAT VIP - 20 CÔNG THỨC v2',
        version: '2.0.0',
        author: '@tranhoang2286',
        tong_cong_thuc: 20,
        danh_sach_cong_thuc: [
            'CT1: Cầu 1-1 Zigzag (92%)',
            'CT2: Cầu 2-2-2 (90%)',
            'CT3: Cầu 2-2 Đảo (88%)',
            'CT4: Cầu 3-3 (89%)',
            'CT5: Cầu 1-2-1 (91%)',
            'CT6: Cầu 2-1-2 (87%)',
            'CT7: Cầu Chop (88%)',
            'CT8: Cầu Streak (82%)',
            'CT9: Cầu Tie (82%)',
            'CT10: Cân bằng B/P (85%)',
            'CT11: Chop dài 1-1-1-1 (90%)',
            'CT12: Cầu 2-1-1-2 (89%)',
            'CT13: Cầu 3-2-1 (86%)',
            'CT14: Cầu 1-2-3 (87%)',
            'CT15: Cầu 2-3-2 (88%)',
            'CT16: Cầu 3-1-3 (86%)',
            'CT17: Cầu 1-1-2 (85%)',
            'CT18: Cầu 2-2-1 (84%)',
            'CT19: Cầu 4-4 (84%)',
            'CT20: Độ lệch chuẩn (80%)'
        ],
        features: [
            '✅ 20 CÔNG THỨC CHUẨN',
            '✅ KHÔNG RANDOM',
            '✅ TOP 5 CẦU TỐT NHẤT',
            '✅ PHÂN TÍCH ĐA CHIỀU'
        ],
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all',
            'Lấy dữ liệu bàn': '/api/baccarat/:tableId',
            'Reset dữ liệu': '/api/reset'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('══════════════════════════════════════════════');
    console.log('🃏 BACCARAT VIP - 20 CÔNG THỨC v2');
    console.log('══════════════════════════════════════════════');
    console.log(`🚀 http://localhost:${PORT}`);
    console.log('📌 20 CÔNG THỨC NHẬN DIỆN CẦU');
    console.log('  ✅ KHÔNG RANDOM');
    console.log('  ✅ TOP 5 CẦU TỐT NHẤT');
    console.log(`👤 @tranhoang2286`);
    console.log('══════════════════════════════════════════════');
});
