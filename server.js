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
        T: cnt.T / total * 100
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

function CT1_Zigzag(arr) {
    if (arr.length < 4) return null;
    const last4 = arr.slice(-4);
    if (last4[0] === last4[2] && last4[1] === last4[3] && last4[0] !== last4[1]) {
        return { predict: last4[0] === 'B' ? 'P' : 'B', name: 'Cau 1-1 Zigzag', conf: 92 };
    }
    return null;
}

function CT2_222(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 2) {
            return { predict: last3[0].c, name: 'Cau 2-2-2', conf: 90 };
        }
    }
    return null;
}

function CT3_22Dao(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[1].n === 2 && last3[2].n === 2 && last3[1].c !== last3[2].c) {
            return { predict: last3[1].c, name: 'Cau 2-2 Dao', conf: 88 };
        }
    }
    return null;
}

function CT4_33(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 3 && last2[1].n === 3) {
            return { predict: last2[0].c === 'B' ? 'P' : 'B', name: 'Cau 3-3', conf: 89 };
        }
    }
    return null;
}

function CT5_121(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 1) {
            return { predict: last3[1].c, name: 'Cau 1-2-1', conf: 91 };
        }
    }
    return null;
}

function CT6_212(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 1 && last3[2].n === 2) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cau 2-1-2', conf: 87 };
        }
    }
    return null;
}

function CT7_Chop(arr) {
    if (arr.length < 8) return null;
    const recent = arr.slice(-8);
    let switches = 0;
    for (let i = 1; i < recent.length; i++) {
        if (recent[i] !== recent[i-1] && recent[i] !== 'T' && recent[i-1] !== 'T') {
            switches++;
        }
    }
    if (switches / 7 >= 0.7) {
        const last = recent[recent.length - 1];
        return { predict: last === 'B' ? 'P' : 'B', name: 'Cau Chop', conf: 88 };
    }
    return null;
}

function CT8_Streak(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    const last = runs[runs.length - 1];
    if (last.n >= 5) {
        return { predict: last.c === 'B' ? 'P' : 'B', name: 'Streak ' + last.c + ' x' + last.n + ' Dao', conf: 82 };
    }
    if (last.n >= 3 && last.n <= 4) {
        return { predict: last.c, name: 'Streak ' + last.c + ' x' + last.n + ' Tiep', conf: 78 };
    }
    return null;
}

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
    if (lastGap > avgGap * 1.5 && avgGap < 20) {
        return { predict: 'T', name: 'Tie Cycle (gap ' + Math.round(avgGap) + ')', conf: 82 };
    }
    return null;
}

function CT10_Balance(arr) {
    if (arr.length < 20) return null;
    const ts = demTanSuat(arr);
    const diff = ts.B - ts.P;
    if (diff > 15) return { predict: 'P', name: 'Balance (B thua ' + Math.round(diff) + '%)', conf: 85 };
    if (diff < -15) return { predict: 'B', name: 'Balance (P thua ' + Math.round(Math.abs(diff)) + '%)', conf: 85 };
    return null;
}

function CT11_ChopDai(arr) {
    if (arr.length < 8) return null;
    const recent = arr.slice(-8);
    const runs = timChuoi(recent);
    if (runs.every(r => r.n === 1) && runs.length >= 6) {
        const last = runs[runs.length - 1].c;
        return { predict: last === 'B' ? 'P' : 'B', name: 'Chop dai 1-1-1-1', conf: 90 };
    }
    return null;
}

function CT12_2112(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cau 2-1-1-2', conf: 89 };
        }
    }
    return null;
}

function CT13_321(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 2 && last3[2].n === 1) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cau 3-2-1', conf: 86 };
        }
    }
    return null;
}

function CT14_123(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 3) {
            return { predict: last3[1].c === 'B' ? 'P' : 'B', name: 'Cau 1-2-3', conf: 87 };
        }
    }
    return null;
}

function CT15_232(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 3 && last3[2].n === 2) {
            return { predict: last3[0].c, name: 'Cau 2-3-2', conf: 88 };
        }
    }
    return null;
}

function CT16_313(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 1 && last3[2].n === 3) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cau 3-1-3', conf: 86 };
        }
    }
    return null;
}

function CT17_112(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 1 && last3[2].n === 2) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cau 1-1-2', conf: 85 };
        }
    }
    return null;
}

function CT18_221(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 1) {
            return { predict: last3[0].c, name: 'Cau 2-2-1', conf: 84 };
        }
    }
    return null;
}

function CT19_44(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 4 && last2[1].n === 4) {
            return { predict: last2[0].c === 'B' ? 'P' : 'B', name: 'Cau 4-4', conf: 84 };
        }
    }
    return null;
}

function CT20_Deviation(arr) {
    if (arr.length < 30) return null;
    const dev = tinhDoLech(arr);
    if (dev.B < -10) return { predict: 'B', name: 'Deviation (B thieu ' + Math.round(Math.abs(dev.B)) + '%)', conf: 80 };
    if (dev.P < -10) return { predict: 'P', name: 'Deviation (P thieu ' + Math.round(Math.abs(dev.P)) + '%)', conf: 80 };
    if (dev.T < -7) return { predict: 'T', name: 'Deviation (T thieu ' + Math.round(Math.abs(dev.T)) + '%)', conf: 76 };
    return null;
}

function duDoan(history) {
    const arr = toArr(history);
    if (arr.length < 5) {
        return {
            Du_doan: 'DOI',
            Ti_le: '0%',
            Do_tin_cay: '0%',
            Loai_cau: 'Chua du du lieu',
            BANKER: '0%',
            PLAYER: '0%',
            TIE: '0%'
        };
    }

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

    if (results.length === 0) {
        const ts = demTanSuat(arr);
        const max = Math.max(ts.B, ts.P, ts.T);
        let predict = 'B';
        let name = 'Tan suat B';
        if (ts.P === max) { predict = 'P'; name = 'Tan suat P'; }
        if (ts.T === max && ts.T > ts.B && ts.T > ts.P) { predict = 'T'; name = 'Tan suat T'; }
        
        return {
            Du_doan: predict === 'B' ? 'BANKER' : predict === 'P' ? 'PLAYER' : 'TIE',
            Ti_le: Math.round(max) + '%',
            Do_tin_cay: '55%',
            Loai_cau: name,
            BANKER: Math.round(ts.B) + '%',
            PLAYER: Math.round(ts.P) + '%',
            TIE: Math.round(ts.T) + '%'
        };
    }

    let scoreB = 0, scoreP = 0, scoreT = 0;
    let countB = 0, countP = 0, countT = 0;

    for (const r of results) {
        if (r.predict === 'B') { scoreB += r.conf; countB++; }
        else if (r.predict === 'P') { scoreP += r.conf; countP++; }
        else if (r.predict === 'T') { scoreT += r.conf; countT++; }
    }

    let avgB = countB > 0 ? scoreB / countB : 30;
    let avgP = countP > 0 ? scoreP / countP : 30;
    let avgT = countT > 0 ? scoreT / countT : 8;

    const total = avgB + avgP + avgT;
    avgB = avgB / total * 100;
    avgP = avgP / total * 100;
    avgT = avgT / total * 100;

    const baseConf = Math.min(50 + results.length * 1.5, 95);
    const confB = Math.min(baseConf + (avgB - 33) * 1.2, 95);
    const confP = Math.min(baseConf + (avgP - 33) * 1.2, 95);
    const confT = Math.min(baseConf + (avgT - 33) * 1.0, 85);

    const sides = [
        {name: 'BANKER', rate: Math.round(avgB), conf: Math.round(confB)},
        {name: 'PLAYER', rate: Math.round(avgP), conf: Math.round(confP)},
        {name: 'TIE', rate: Math.round(avgT), conf: Math.round(confT)}
    ];
    sides.sort((a,b) => b.conf - a.conf);
    const best = sides[0];

    results.sort((a,b) => b.conf - a.conf);
    const top5 = results.slice(0, 5).map(r => r.name + ' (' + r.conf + '%)').join(' | ');

    return {
        Du_doan: best.name,
        Ti_le: best.rate + '%',
        Do_tin_cay: best.conf + '%',
        Loai_cau: results[0]?.name || 'Khong xac dinh',
        BANKER: Math.round(avgB) + '% (' + Math.round(confB) + '%)',
        PLAYER: Math.round(avgP) + '% (' + Math.round(confP) + '%)',
        TIE: Math.round(avgT) + '% (' + Math.round(confT) + '%)',
        So_cong_thuc: results.length + '/20',
        Top_5_cau: top5
    };
}

async function fetchTableData(tableId) {
    try {
        const url = API_BASE + '/api/baccarat/' + tableId.toUpperCase();
        console.log('📡 ' + url);
        const res = await axios.get(url, { timeout: 15000 });
        if (res.data?.success && res.data?.data) return res.data.data.result || '';
        return '';
    } catch (e) {
        console.error('❌ ' + tableId + ':', e.message);
        return '';
    }
}

app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const cauGoc = await fetchTableData(tableId);
        if (!cauGoc) {
            return res.json({ success: false, message: 'Khong tim thay ban ' + tableId });
        }

        const old = lastData[tableId] || '';
        const isNew = cauGoc !== old && cauGoc.length > old.length;
        lastData[tableId] = cauGoc;
        if (!sessionData[tableId]) sessionData[tableId] = 0;
        if (isNew) sessionData[tableId]++;

        const result = duDoan(cauGoc);

        res.json({
            phien: sessionData[tableId],
            cau_goc: cauGoc,
            Du_doan: result.Du_doan,
            Ti_le: result.Ti_le,
            Do_tin_cay: result.Do_tin_cay,
            Loai_cau: result.Loai_cau,
            BANKER: result.BANKER,
            PLAYER: result.PLAYER,
            TIE: result.TIE,
            So_cong_thuc: result.So_cong_thuc,
            Top_5_cau: result.Top_5_cau,
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

            const result = duDoan(cauGoc);
            
            predictions[id] = {
                phien: sessionData[id],
                Du_doan: result.Du_doan,
                Ti_le: result.Ti_le,
                Do_tin_cay: result.Do_tin_cay,
                Loai_cau: result.Loai_cau,
                BANKER: result.BANKER,
                PLAYER: result.PLAYER,
                TIE: result.TIE
            };
        }

        res.json({
            success: true,
            engine: 'VIP-20-CONGTHUC',
            timestamp: new Date().toISOString(),
            author: '@tranhoang2286',
            tong_cong_thuc: 20,
            predictions: predictions
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
            res.json({ success: true, data: { table: tableId, result: result, shoeId: '', round: '' } });
        } else {
            res.json({ success: false, message: 'Khong tim thay ban ' + tableId });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/', (req, res) => {
    res.json({
        name: 'BACCARAT VIP - 20 CONG THUC',
        version: '1.0.0',
        author: '@tranhoang2286',
        tong_cong_thuc: 20,
        endpoints: {
            'Du doan 1 ban': '/api/predict/:tableId',
            'Du doan tat ca': '/api/predict/all',
            'Lay du lieu ban': '/api/baccarat/:tableId'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('BACCARAT VIP - 20 CONG THUC');
    console.log('========================================');
    console.log('🚀 http://localhost:' + PORT);
    console.log('👤 @tranhoang2286');
    console.log('========================================');
});
