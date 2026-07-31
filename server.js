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
        B: (cnt.B / total * 100),
        P: (cnt.P / total * 100),
        T: (cnt.T / total * 100)
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

// ==================== CÔNG THỨC VIP 1: VỆT DÀI ====================
function CT_VetDai(arr) {
    if (arr.length < 3) return null;
    const runs = timChuoi(arr);
    const last = runs[runs.length - 1];
    
    if (last.n >= 5) {
        return {
            predict: last.c === 'B' ? 'P' : 'B',
            name: `VỆT ${last.c} x${last.n} - ĐẢO`,
            conf: 92,
            type: 'VIP'
        };
    }
    if (last.n === 4) {
        return {
            predict: last.c === 'B' ? 'P' : 'B',
            name: `VỆT ${last.c} x4 - ĐẢO`,
            conf: 88,
            type: 'VIP'
        };
    }
    if (last.n === 3) {
        return {
            predict: last.c,
            name: `VỆT ${last.c} x3 - TIẾP`,
            conf: 82,
            type: 'VIP'
        };
    }
    return null;
}

// ==================== CÔNG THỨC VIP 2: CẦU 1-1 ZIGZAG ====================
function CT_Zigzag(arr) {
    if (arr.length < 6) return null;
    const last6 = arr.slice(-6);
    let isZigzag = true;
    for (let i = 1; i < last6.length; i++) {
        if (last6[i] === last6[i-1] || last6[i] === 'T' || last6[i-1] === 'T') {
            isZigzag = false;
            break;
        }
    }
    if (isZigzag) {
        const last = last6[last6.length - 1];
        return {
            predict: last === 'B' ? 'P' : 'B',
            name: 'CẦU 1-1 ZIGZAG',
            conf: 91,
            type: 'VIP'
        };
    }
    return null;
}

// ==================== CÔNG THỨC VIP 3: CẦU 2-2 ====================
function CT_222(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 2) {
            return {
                predict: last3[0].c,
                name: 'CẦU 2-2-2',
                conf: 93,
                type: 'VIP'
            };
        }
        if (last3[1].n === 2 && last3[2].n === 2) {
            return {
                predict: last3[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 2-2',
                conf: 86,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 4: CẦU 3-3 ====================
function CT_333(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 3 && last3[2].n === 3) {
            return {
                predict: last3[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 3-3-3',
                conf: 92,
                type: 'VIP'
            };
        }
    }
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 3 && last2[1].n === 3) {
            return {
                predict: last2[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 3-3',
                conf: 87,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 5: CẦU 4-4 ====================
function CT_444(arr) {
    if (arr.length < 12) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 4 && last2[1].n === 4) {
            return {
                predict: last2[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 4-4',
                conf: 90,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 6: CẦU 1-2-1 ====================
function CT_121(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 2) {
            return {
                predict: last4[1].c,
                name: 'CẦU 1-2-1-2',
                conf: 94,
                type: 'VIP'
            };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 1) {
            return {
                predict: last3[1].c,
                name: 'CẦU 1-2-1',
                conf: 89,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 7: CẦU 2-1-2 ====================
function CT_212(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 1) {
            return {
                predict: last4[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 2-1-2-1',
                conf: 93,
                type: 'VIP'
            };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 1 && last3[2].n === 2) {
            return {
                predict: last3[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 2-1-2',
                conf: 88,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 8: CHÓP DÀI ====================
function CT_Chop(arr) {
    if (arr.length < 10) return null;
    const last10 = arr.slice(-10);
    const runs = timChuoi(last10);
    if (runs.every(r => r.n === 1) && runs.length >= 8) {
        const last = runs[runs.length - 1].c;
        return {
            predict: last === 'B' ? 'P' : 'B',
            name: 'CHÓP DÀI 8-10',
            conf: 95,
            type: 'VIP'
        };
    }
    if (arr.length >= 8) {
        const last8 = arr.slice(-8);
        const runs8 = timChuoi(last8);
        if (runs8.every(r => r.n === 1) && runs8.length >= 6) {
            const last = runs8[runs8.length - 1].c;
            return {
                predict: last === 'B' ? 'P' : 'B',
                name: 'CHÓP DÀI 6-8',
                conf: 91,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 9: CÂN BẰNG ====================
function CT_Balance(arr) {
    if (arr.length < 30) return null;
    const stats = demTanSuat(arr);
    const diff = stats.B - stats.P;
    
    if (diff > 20) {
        return {
            predict: 'P',
            name: `BALANCE B>P ${Math.round(diff)}%`,
            conf: 88,
            type: 'VIP'
        };
    }
    if (diff < -20) {
        return {
            predict: 'B',
            name: `BALANCE P>B ${Math.round(Math.abs(diff))}%`,
            conf: 88,
            type: 'VIP'
        };
    }
    if (diff > 15) {
        return {
            predict: 'P',
            name: `BALANCE B>P ${Math.round(diff)}%`,
            conf: 82,
            type: 'VIP'
        };
    }
    if (diff < -15) {
        return {
            predict: 'B',
            name: `BALANCE P>B ${Math.round(Math.abs(diff))}%`,
            conf: 82,
            type: 'VIP'
        };
    }
    return null;
}

// ==================== CÔNG THỨC VIP 10: TIE CYCLE ====================
function CT_Tie(arr) {
    if (arr.length < 15) return null;
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
    
    if (lastGap > avgGap * 1.8 && avgGap < 15) {
        return {
            predict: 'T',
            name: `TIE CYCLE (gap ${Math.round(avgGap)})`,
            conf: 84,
            type: 'VIP'
        };
    }
    return null;
}

// ==================== CÔNG THỨC VIP 11: CẦU 3-2-1 ====================
function CT_321(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 2) {
            return {
                predict: last4[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 3-2-1-2',
                conf: 90,
                type: 'VIP'
            };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 2 && last3[2].n === 1) {
            return {
                predict: last3[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 3-2-1',
                conf: 86,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 12: CẦU 1-2-3 ====================
function CT_123(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 3 && last4[3].n === 1) {
            return {
                predict: last4[1].c === 'B' ? 'P' : 'B',
                name: 'CẦU 1-2-3-1',
                conf: 89,
                type: 'VIP'
            };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 3) {
            return {
                predict: last3[1].c === 'B' ? 'P' : 'B',
                name: 'CẦU 1-2-3',
                conf: 87,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 13: CẦU 2-3-2 ====================
function CT_232(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 3 && last4[2].n === 2 && last4[3].n === 3) {
            return {
                predict: last4[0].c,
                name: 'CẦU 2-3-2-3',
                conf: 91,
                type: 'VIP'
            };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 3 && last3[2].n === 2) {
            return {
                predict: last3[0].c,
                name: 'CẦU 2-3-2',
                conf: 88,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 14: CẦU 3-1-3 ====================
function CT_313(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 1 && last4[2].n === 3 && last4[3].n === 1) {
            return {
                predict: last4[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 3-1-3-1',
                conf: 90,
                type: 'VIP'
            };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 1 && last3[2].n === 3) {
            return {
                predict: last3[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 3-1-3',
                conf: 86,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 15: CẦU 2-2-1 ====================
function CT_221(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 2) {
            return {
                predict: last4[0].c,
                name: 'CẦU 2-2-1-2',
                conf: 89,
                type: 'VIP'
            };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 1) {
            return {
                predict: last3[0].c,
                name: 'CẦU 2-2-1',
                conf: 84,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 16: CẦU 1-1-2 ====================
function CT_112(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 1) {
            return {
                predict: last4[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 1-1-2-1',
                conf: 88,
                type: 'VIP'
            };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 1 && last3[2].n === 2) {
            return {
                predict: last3[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 1-1-2',
                conf: 85,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 17: CẦU 2-3-1 ====================
function CT_231(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 3 && last3[2].n === 1) {
            return {
                predict: last3[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 2-3-1',
                conf: 87,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 18: CẦU 1-3-2 ====================
function CT_132(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 3 && last3[2].n === 2) {
            return {
                predict: last3[0].c === 'B' ? 'P' : 'B',
                name: 'CẦU 1-3-2',
                conf: 86,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 19: PATTERN 1-2-1-2 ====================
function CT_Pattern1212(arr) {
    if (arr.length < 12) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 6) {
        const last6 = runs.slice(-6);
        const pattern = last6.map(r => r.n);
        if (pattern.every((n, i) => n === (i % 2 === 0 ? 1 : 2))) {
            const last = last6[last6.length - 1].c;
            return {
                predict: last === 'B' ? 'P' : 'B',
                name: 'PATTERN 1-2-1-2-1-2',
                conf: 96,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== CÔNG THỨC VIP 20: PATTERN 2-1-2-1 ====================
function CT_Pattern2121(arr) {
    if (arr.length < 12) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 6) {
        const last6 = runs.slice(-6);
        const pattern = last6.map(r => r.n);
        if (pattern.every((n, i) => n === (i % 2 === 0 ? 2 : 1))) {
            const last = last6[last6.length - 1].c;
            return {
                predict: last === 'B' ? 'P' : 'B',
                name: 'PATTERN 2-1-2-1-2-1',
                conf: 96,
                type: 'VIP'
            };
        }
    }
    return null;
}

// ==================== HÀM DỰ ĐOÁN CHÍNH ====================

function duDoan(history) {
    const arr = toArr(history);
    if (arr.length < 5) {
        return {
            Du_doan: 'CHỜ',
            Ti_le: '0%',
            Do_tin_cay: '0%',
            Loai_cau: 'CHƯA ĐỦ DỮ LIỆU',
            BANKER: '0%',
            PLAYER: '0%',
            TIE: '0%',
            So_cong_thuc: '0/20',
            Top_cau: 'CHỜ'
        };
    }

    // ========== CHẠY 20 CÔNG THỨC VIP ==========
    const results = [];
    const formulas = [
        CT_VetDai, CT_Zigzag, CT_222, CT_333, CT_444,
        CT_121, CT_212, CT_Chop, CT_Balance, CT_Tie,
        CT_321, CT_123, CT_232, CT_313, CT_221,
        CT_112, CT_231, CT_132, CT_Pattern1212, CT_Pattern2121
    ];

    for (const formula of formulas) {
        const result = formula(arr);
        if (result) {
            results.push(result);
        }
    }

    // ========== NẾU KHÔNG CÓ CÔNG THỨC NÀO ==========
    if (results.length === 0) {
        const stats = demTanSuat(arr);
        let max = Math.max(stats.B, stats.P, stats.T);
        let predict = stats.B === max ? 'B' : stats.P === max ? 'P' : 'T';
        let name = predict === 'B' ? 'TẦN SUẤT B' : predict === 'P' ? 'TẦN SUẤT P' : 'TẦN SUẤT T';
        
        return {
            Du_doan: predict === 'B' ? 'BANKER' : predict === 'P' ? 'PLAYER' : 'TIE',
            Ti_le: Math.round(max) + '%',
            Do_tin_cay: '55%',
            Loai_cau: name,
            BANKER: Math.round(stats.B) + '%',
            PLAYER: Math.round(stats.P) + '%',
            TIE: Math.round(stats.T) + '%',
            So_cong_thuc: '0/20',
            Top_cau: 'KHÔNG CÓ CẦU'
        };
    }

    // ========== TÍNH ĐIỂM ==========
    let scoreB = 0, scoreP = 0, scoreT = 0;
    let countB = 0, countP = 0, countT = 0;

    for (const r of results) {
        if (r.predict === 'B') { scoreB += r.conf; countB++; }
        else if (r.predict === 'P') { scoreP += r.conf; countP++; }
        else if (r.predict === 'T') { scoreT += r.conf; countT++; }
    }

    let avgB = countB > 0 ? scoreB / countB : 25;
    let avgP = countP > 0 ? scoreP / countP : 25;
    let avgT = countT > 0 ? scoreT / countT : 5;

    const total = avgB + avgP + avgT;
    avgB = (avgB / total * 100);
    avgP = (avgP / total * 100);
    avgT = (avgT / total * 100);

    // ========== TÍNH ĐỘ TIN CẬY ==========
    const baseConf = 50 + results.length * 2.5;
    const confB = Math.min(baseConf + (avgB - 33) * 1.8, 98);
    const confP = Math.min(baseConf + (avgP - 33) * 1.8, 98);
    const confT = Math.min(baseConf + (avgT - 33) * 1.2, 88);

    const sides = [
        {name: 'BANKER', rate: Math.round(avgB), conf: Math.round(confB)},
        {name: 'PLAYER', rate: Math.round(avgP), conf: Math.round(confP)},
        {name: 'TIE', rate: Math.round(avgT), conf: Math.round(confT)}
    ];
    sides.sort((a,b) => b.conf - a.conf);
    const best = sides[0];

    // ========== TOP CẦU VIP ==========
    results.sort((a,b) => b.conf - a.conf);
    const top5 = results.slice(0, 5).map((r, i) => `${i+1}.${r.name}`).join(' | ');

    // ========== KẾT QUẢ ==========
    return {
        Du_doan: best.name,
        Ti_le: best.rate + '%',
        Do_tin_cay: best.conf + '%',
        Loai_cau: results[0]?.name || 'KHÔNG XÁC ĐỊNH',
        BANKER: Math.round(avgB) + '% (' + Math.round(confB) + '%)',
        PLAYER: Math.round(avgP) + '% (' + Math.round(confP) + '%)',
        TIE: Math.round(avgT) + '% (' + Math.round(confT) + '%)',
        So_cong_thuc: results.length + '/20',
        Top_cau: top5,
        Loai: 'VIP'
    };
}

// ==================== LẤY DỮ LIỆU ====================

async function fetchTableData(tableId) {
    try {
        const url = API_BASE + '/api/baccarat/' + tableId.toUpperCase();
        console.log('📡 FETCH:', url);
        const res = await axios.get(url, { timeout: 15000 });
        if (res.data?.success && res.data?.data) return res.data.data.result || '';
        return '';
    } catch (e) {
        console.error('❌ ERROR:', tableId, e.message);
        return '';
    }
}

// ==================== API ENDPOINTS ====================

app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const cauGoc = await fetchTableData(tableId);
        if (!cauGoc) {
            return res.json({ 
                success: false, 
                message: 'KHÔNG TÌM THẤY BÀN ' + tableId 
            });
        }

        const old = lastData[tableId] || '';
        const isNew = cauGoc !== old && cauGoc.length > old.length;
        lastData[tableId] = cauGoc;
        if (!sessionData[tableId]) sessionData[tableId] = 0;
        if (isNew) sessionData[tableId]++;

        const result = duDoan(cauGoc);

        res.json({
            success: true,
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
            Top_cau: result.Top_cau,
            Loai: result.Loai,
            author: '@tranhoang2286',
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ 
            success: false, 
            error: e.message 
        });
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
                TIE: result.TIE,
                Top_cau: result.Top_cau
            };
        }

        res.json({
            success: true,
            engine: 'VIP-20-CONGTHUC',
            version: '3.0.0',
            timestamp: new Date().toISOString(),
            author: '@tranhoang2286',
            tong_cong_thuc: 20,
            predictions: predictions
        });
    } catch (e) {
        res.status(500).json({ 
            success: false, 
            error: e.message 
        });
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
                    result: result 
                } 
            });
        } else {
            res.json({ 
                success: false, 
                message: 'KHÔNG TÌM THẤY BÀN ' + tableId 
            });
        }
    } catch (e) {
        res.status(500).json({ 
            success: false, 
            error: e.message 
        });
    }
});

app.get('/', (req, res) => {
    res.json({
        name: 'BACCARAT VIP - 20 CÔNG THỨC',
        version: '3.0.0',
        author: '@tranhoang2286',
        tong_cong_thuc: 20,
        loai: 'VIP - KHÔNG RANDOM',
        cong_thuc: [
            '1. VỆT DÀI (Đảo/Tiếp)',
            '2. CẦU 1-1 ZIGZAG',
            '3. CẦU 2-2-2',
            '4. CẦU 3-3-3',
            '5. CẦU 4-4',
            '6. CẦU 1-2-1',
            '7. CẦU 2-1-2',
            '8. CHÓP DÀI',
            '9. CÂN BẰNG B/P',
            '10. TIE CYCLE',
            '11. CẦU 3-2-1',
            '12. CẦU 1-2-3',
            '13. CẦU 2-3-2',
            '14. CẦU 3-1-3',
            '15. CẦU 2-2-1',
            '16. CẦU 1-1-2',
            '17. CẦU 2-3-1',
            '18. CẦU 1-3-2',
            '19. PATTERN 1-2-1-2',
            '20. PATTERN 2-1-2-1'
        ],
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all',
            'Lấy dữ liệu': '/api/baccarat/:tableId'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('  BACCARAT VIP - 20 CÔNG THỨC');
    console.log('========================================');
    console.log('🚀 http://localhost:' + PORT);
    console.log('👤 @tranhoang2286');
    console.log('📊 20 CÔNG THỨC VIP - KHÔNG RANDOM');
    console.log('========================================');
});
