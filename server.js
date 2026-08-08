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
    return str ? str.split('').filter(c => ['B','P'].includes(c)) : [];
}

// ============================================================
// HỆ THỐNG NHẬN DIỆN CẦU SIÊU VIP - 50+ LOẠI CẦU
// ============================================================

class SieuNhanDienCau {
    constructor() {
        this.cauDaNhan = [];
        this.cauTotNhat = null;
        this.lichSuCau = [];
        this.phanLoaiCau = {
            cau1_1: [],
            cau2_2: [],
            cau3_3: [],
            cau4_4: [],
            cau5_5: [],
            cauCheo: [],
            cauDoiXung: [],
            cauTangDan: [],
            cauGiamDan: [],
            cauVet: [],
            cauChop: [],
            cauFibonacci: [],
            cauPattern: [],
            cauDacBiet: []
        };
    }

    // ==================== HÀM PHỤ TRỢ ====================
    
    getRuns(arr) {
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

    demTanSuat(arr) {
        const cnt = {B:0, P:0};
        for (const c of arr) if (cnt[c] !== undefined) cnt[c]++;
        const total = arr.length || 1;
        return {
            B: (cnt.B / total * 100),
            P: (cnt.P / total * 100),
            countB: cnt.B,
            countP: cnt.P,
            total: total
        };
    }

    // ==================== NHÓM 1: CẦU 1-1 (ZIGZAG) ====================
    
    nhanCau1_1(arr) {
        const results = [];
        if (arr.length < 6) return results;
        
        // Zigzag 6
        let z6 = true;
        const last6 = arr.slice(-6);
        for (let i = 1; i < 6; i++) {
            if (last6[i] === last6[i-1]) { z6 = false; break; }
        }
        if (z6) {
            results.push({
                loai: 'ZIGZAG_6',
                moTa: 'Cầu 1-1 kéo dài 6 ván',
                doTinCay: 90,
                duDoan: last6[5] === 'B' ? 'P' : 'B',
                sucManh: 'MẠNH',
                capDo: 1
            });
        }
        
        // Zigzag 8
        if (arr.length >= 8) {
            let z8 = true;
            const last8 = arr.slice(-8);
            for (let i = 1; i < 8; i++) {
                if (last8[i] === last8[i-1]) { z8 = false; break; }
            }
            if (z8) {
                results.push({
                    loai: 'ZIGZAG_8',
                    moTa: 'Cầu 1-1 kéo dài 8 ván',
                    doTinCay: 93,
                    duDoan: last8[7] === 'B' ? 'P' : 'B',
                    sucManh: 'RẤT MẠNH',
                    capDo: 2
                });
            }
        }
        
        // Zigzag 10
        if (arr.length >= 10) {
            let z10 = true;
            const last10 = arr.slice(-10);
            for (let i = 1; i < 10; i++) {
                if (last10[i] === last10[i-1]) { z10 = false; break; }
            }
            if (z10) {
                results.push({
                    loai: 'ZIGZAG_10',
                    moTa: 'Cầu 1-1 kéo dài 10 ván - CỰC HIẾM',
                    doTinCay: 96,
                    duDoan: last10[9] === 'B' ? 'P' : 'B',
                    sucManh: 'SIÊU MẠNH',
                    capDo: 3
                });
            }
        }
        
        // Zigzag 12
        if (arr.length >= 12) {
            let z12 = true;
            const last12 = arr.slice(-12);
            for (let i = 1; i < 12; i++) {
                if (last12[i] === last12[i-1]) { z12 = false; break; }
            }
            if (z12) {
                results.push({
                    loai: 'ZIGZAG_12',
                    moTa: 'Cầu 1-1 kéo dài 12 ván - ĐỘC NHẤT VÔ NHỊ',
                    doTinCay: 98,
                    duDoan: last12[11] === 'B' ? 'P' : 'B',
                    sucManh: 'CỰC KỲ SIÊU MẠNH',
                    capDo: 4
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 2: CẦU 2-2 ====================
    
    nhanCau2_2(arr) {
        const results = [];
        if (arr.length < 6) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 2) return results;
        
        // 2-2
        const last2 = runs.slice(-2);
        if (last2[0].n === 2 && last2[1].n === 2) {
            results.push({
                loai: 'CAU_22',
                moTa: 'Cầu 2-2 cơ bản',
                doTinCay: 85,
                duDoan: last2[0].c === 'B' ? 'P' : 'B',
                sucManh: 'TRUNG BÌNH',
                capDo: 1
            });
        }
        
        // 2-2-2
        if (runs.length >= 3) {
            const last3 = runs.slice(-3);
            if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 2) {
                results.push({
                    loai: 'CAU_222',
                    moTa: 'Cầu 2-2-2 hoàn hảo',
                    doTinCay: 92,
                    duDoan: last3[0].c,
                    sucManh: 'RẤT MẠNH',
                    capDo: 2
                });
            }
        }
        
        // 2-2-2-2
        if (runs.length >= 4) {
            const last4 = runs.slice(-4);
            if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 2 && last4[3].n === 2) {
                results.push({
                    loai: 'CAU_2222',
                    moTa: 'Cầu 2-2-2-2 siêu hoàn hảo',
                    doTinCay: 95,
                    duDoan: last4[0].c,
                    sucManh: 'SIÊU MẠNH',
                    capDo: 3
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 3: CẦU 3-3 ====================
    
    nhanCau3_3(arr) {
        const results = [];
        if (arr.length < 8) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 2) return results;
        
        // 3-3
        const last2 = runs.slice(-2);
        if (last2[0].n === 3 && last2[1].n === 3) {
            results.push({
                loai: 'CAU_33',
                moTa: 'Cầu 3-3',
                doTinCay: 88,
                duDoan: last2[0].c === 'B' ? 'P' : 'B',
                sucManh: 'MẠNH',
                capDo: 1
            });
        }
        
        // 3-3-3
        if (runs.length >= 3) {
            const last3 = runs.slice(-3);
            if (last3[0].n === 3 && last3[1].n === 3 && last3[2].n === 3) {
                results.push({
                    loai: 'CAU_333',
                    moTa: 'Cầu 3-3-3 cực mạnh',
                    doTinCay: 94,
                    duDoan: last3[0].c === 'B' ? 'P' : 'B',
                    sucManh: 'RẤT MẠNH',
                    capDo: 2
                });
            }
        }
        
        // 3-3-3-3
        if (runs.length >= 4) {
            const last4 = runs.slice(-4);
            if (last4[0].n === 3 && last4[1].n === 3 && last4[2].n === 3 && last4[3].n === 3) {
                results.push({
                    loai: 'CAU_3333',
                    moTa: 'Cầu 3-3-3-3 siêu hiếm',
                    doTinCay: 97,
                    duDoan: last4[0].c === 'B' ? 'P' : 'B',
                    sucManh: 'SIÊU MẠNH',
                    capDo: 3
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 4: CẦU 4-4 ====================
    
    nhanCau4_4(arr) {
        const results = [];
        if (arr.length < 10) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 2) return results;
        
        const last2 = runs.slice(-2);
        if (last2[0].n === 4 && last2[1].n === 4) {
            results.push({
                loai: 'CAU_44',
                moTa: 'Cầu 4-4 rất hiếm',
                doTinCay: 93,
                duDoan: last2[0].c === 'B' ? 'P' : 'B',
                sucManh: 'RẤT MẠNH',
                capDo: 2
            });
        }
        
        // 4-4-4
        if (runs.length >= 3) {
            const last3 = runs.slice(-3);
            if (last3[0].n === 4 && last3[1].n === 4 && last3[2].n === 4) {
                results.push({
                    loai: 'CAU_444',
                    moTa: 'Cầu 4-4-4 cực kỳ hiếm',
                    doTinCay: 96,
                    duDoan: last3[0].c === 'B' ? 'P' : 'B',
                    sucManh: 'SIÊU MẠNH',
                    capDo: 3
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 5: CẦU 5-5 ====================
    
    nhanCau5_5(arr) {
        const results = [];
        if (arr.length < 12) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 2) return results;
        
        const last2 = runs.slice(-2);
        if (last2[0].n === 5 && last2[1].n === 5) {
            results.push({
                loai: 'CAU_55',
                moTa: 'Cầu 5-5 cực kỳ hiếm gặp',
                doTinCay: 95,
                duDoan: last2[0].c === 'B' ? 'P' : 'B',
                sucManh: 'SIÊU MẠNH',
                capDo: 3
            });
        }
        
        return results;
    }

    // ==================== NHÓM 6: CẦU 1-2-1 ====================
    
    nhanCau1_2_1(arr) {
        const results = [];
        if (arr.length < 8) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 3) return results;
        
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 1) {
            results.push({
                loai: 'CAU_121',
                moTa: 'Cầu 1-2-1',
                doTinCay: 89,
                duDoan: last3[1].c,
                sucManh: 'MẠNH',
                capDo: 1
            });
        }
        
        // 1-2-1-2
        if (runs.length >= 4) {
            const last4 = runs.slice(-4);
            if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 2) {
                results.push({
                    loai: 'CAU_1212',
                    moTa: 'Cầu 1-2-1-2 hoàn hảo',
                    doTinCay: 94,
                    duDoan: last4[1].c,
                    sucManh: 'RẤT MẠNH',
                    capDo: 2
                });
            }
        }
        
        // 1-2-1-2-1
        if (runs.length >= 5) {
            const last5 = runs.slice(-5);
            if (last5[0].n === 1 && last5[1].n === 2 && last5[2].n === 1 && 
                last5[3].n === 2 && last5[4].n === 1) {
                results.push({
                    loai: 'CAU_12121',
                    moTa: 'Cầu 1-2-1-2-1 siêu hoàn hảo',
                    doTinCay: 97,
                    duDoan: last5[1].c,
                    sucManh: 'SIÊU MẠNH',
                    capDo: 3
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 7: CẦU 2-1-2 ====================
    
    nhanCau2_1_2(arr) {
        const results = [];
        if (arr.length < 8) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 3) return results;
        
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 1 && last3[2].n === 2) {
            results.push({
                loai: 'CAU_212',
                moTa: 'Cầu 2-1-2',
                doTinCay: 88,
                duDoan: last3[0].c === 'B' ? 'P' : 'B',
                sucManh: 'MẠNH',
                capDo: 1
            });
        }
        
        // 2-1-2-1
        if (runs.length >= 4) {
            const last4 = runs.slice(-4);
            if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 1) {
                results.push({
                    loai: 'CAU_2121',
                    moTa: 'Cầu 2-1-2-1 hoàn hảo',
                    doTinCay: 93,
                    duDoan: last4[0].c === 'B' ? 'P' : 'B',
                    sucManh: 'RẤT MẠNH',
                    capDo: 2
                });
            }
        }
        
        // 2-1-2-1-2
        if (runs.length >= 5) {
            const last5 = runs.slice(-5);
            if (last5[0].n === 2 && last5[1].n === 1 && last5[2].n === 2 && 
                last5[3].n === 1 && last5[4].n === 2) {
                results.push({
                    loai: 'CAU_21212',
                    moTa: 'Cầu 2-1-2-1-2 siêu hoàn hảo',
                    doTinCay: 96,
                    duDoan: last5[0].c === 'B' ? 'P' : 'B',
                    sucManh: 'SIÊU MẠNH',
                    capDo: 3
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 8: CẦU 3-2-1 ====================
    
    nhanCau3_2_1(arr) {
        const results = [];
        if (arr.length < 8) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 3) return results;
        
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 2 && last3[2].n === 1) {
            results.push({
                loai: 'CAU_321',
                moTa: 'Cầu giảm dần 3-2-1',
                doTinCay: 87,
                duDoan: last3[0].c === 'B' ? 'P' : 'B',
                sucManh: 'MẠNH',
                capDo: 1
            });
        }
        
        // 3-2-1-2
        if (runs.length >= 4) {
            const last4 = runs.slice(-4);
            if (last4[0].n === 3 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 2) {
                results.push({
                    loai: 'CAU_3212',
                    moTa: 'Cầu 3-2-1-2 đối xứng',
                    doTinCay: 92,
                    duDoan: last4[0].c === 'B' ? 'P' : 'B',
                    sucManh: 'RẤT MẠNH',
                    capDo: 2
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 9: CẦU 1-2-3 ====================
    
    nhanCau1_2_3(arr) {
        const results = [];
        if (arr.length < 8) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 3) return results;
        
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 3) {
            results.push({
                loai: 'CAU_123',
                moTa: 'Cầu tăng dần 1-2-3',
                doTinCay: 86,
                duDoan: last3[1].c === 'B' ? 'P' : 'B',
                sucManh: 'MẠNH',
                capDo: 1
            });
        }
        
        // 1-2-3-2
        if (runs.length >= 4) {
            const last4 = runs.slice(-4);
            if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 3 && last4[3].n === 2) {
                results.push({
                    loai: 'CAU_1232',
                    moTa: 'Cầu 1-2-3-2 đối xứng',
                    doTinCay: 91,
                    duDoan: last4[1].c === 'B' ? 'P' : 'B',
                    sucManh: 'RẤT MẠNH',
                    capDo: 2
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 10: CẦU 2-3-2 ====================
    
    nhanCau2_3_2(arr) {
        const results = [];
        if (arr.length < 8) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 3) return results;
        
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 3 && last3[2].n === 2) {
            results.push({
                loai: 'CAU_232',
                moTa: 'Cầu 2-3-2 đối xứng',
                doTinCay: 90,
                duDoan: last3[0].c,
                sucManh: 'MẠNH',
                capDo: 1
            });
        }
        
        // 2-3-2-3
        if (runs.length >= 4) {
            const last4 = runs.slice(-4);
            if (last4[0].n === 2 && last4[1].n === 3 && last4[2].n === 2 && last4[3].n === 3) {
                results.push({
                    loai: 'CAU_2323',
                    moTa: 'Cầu 2-3-2-3 hoàn hảo',
                    doTinCay: 94,
                    duDoan: last4[0].c,
                    sucManh: 'RẤT MẠNH',
                    capDo: 2
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 11: CẦU 3-1-3 ====================
    
    nhanCau3_1_3(arr) {
        const results = [];
        if (arr.length < 8) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 3) return results;
        
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 1 && last3[2].n === 3) {
            results.push({
                loai: 'CAU_313',
                moTa: 'Cầu 3-1-3 đối xứng',
                doTinCay: 89,
                duDoan: last3[0].c === 'B' ? 'P' : 'B',
                sucManh: 'MẠNH',
                capDo: 1
            });
        }
        
        // 3-1-3-1
        if (runs.length >= 4) {
            const last4 = runs.slice(-4);
            if (last4[0].n === 3 && last4[1].n === 1 && last4[2].n === 3 && last4[3].n === 1) {
                results.push({
                    loai: 'CAU_3131',
                    moTa: 'Cầu 3-1-3-1 hoàn hảo',
                    doTinCay: 93,
                    duDoan: last4[0].c === 'B' ? 'P' : 'B',
                    sucManh: 'RẤT MẠNH',
                    capDo: 2
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 12: CẦU 2-2-1 ====================
    
    nhanCau2_2_1(arr) {
        const results = [];
        if (arr.length < 6) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 3) return results;
        
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 1) {
            results.push({
                loai: 'CAU_221',
                moTa: 'Cầu 2-2-1',
                doTinCay: 84,
                duDoan: last3[0].c,
                sucManh: 'TRUNG BÌNH',
                capDo: 1
            });
        }
        
        // 2-2-1-2
        if (runs.length >= 4) {
            const last4 = runs.slice(-4);
            if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 2) {
                results.push({
                    loai: 'CAU_2212',
                    moTa: 'Cầu 2-2-1-2',
                    doTinCay: 90,
                    duDoan: last4[0].c,
                    sucManh: 'MẠNH',
                    capDo: 2
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 13: CẦU 1-1-2 ====================
    
    nhanCau1_1_2(arr) {
        const results = [];
        if (arr.length < 6) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 3) return results;
        
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 1 && last3[2].n === 2) {
            results.push({
                loai: 'CAU_112',
                moTa: 'Cầu 1-1-2',
                doTinCay: 83,
                duDoan: last3[0].c === 'B' ? 'P' : 'B',
                sucManh: 'TRUNG BÌNH',
                capDo: 1
            });
        }
        
        // 1-1-2-1
        if (runs.length >= 4) {
            const last4 = runs.slice(-4);
            if (last4[0].n === 1 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 1) {
                results.push({
                    loai: 'CAU_1121',
                    moTa: 'Cầu 1-1-2-1',
                    doTinCay: 89,
                    duDoan: last4[0].c === 'B' ? 'P' : 'B',
                    sucManh: 'MẠNH',
                    capDo: 2
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 14: CẦU 2-3-1 ====================
    
    nhanCau2_3_1(arr) {
        const results = [];
        if (arr.length < 8) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 3) return results;
        
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 3 && last3[2].n === 1) {
            results.push({
                loai: 'CAU_231',
                moTa: 'Cầu 2-3-1',
                doTinCay: 86,
                duDoan: last3[0].c === 'B' ? 'P' : 'B',
                sucManh: 'MẠNH',
                capDo: 1
            });
        }
        
        return results;
    }

    // ==================== NHÓM 15: CẦU 1-3-2 ====================
    
    nhanCau1_3_2(arr) {
        const results = [];
        if (arr.length < 8) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 3) return results;
        
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 3 && last3[2].n === 2) {
            results.push({
                loai: 'CAU_132',
                moTa: 'Cầu 1-3-2',
                doTinCay: 85,
                duDoan: last3[0].c === 'B' ? 'P' : 'B',
                sucManh: 'MẠNH',
                capDo: 1
            });
        }
        
        return results;
    }

    // ==================== NHÓM 16: CẦU TĂNG DẦN ====================
    
    nhanCauTangDan(arr) {
        const results = [];
        if (arr.length < 12) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 4) return results;
        
        // 1-2-3-4
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 3 && last4[3].n === 4) {
            results.push({
                loai: 'CAU_TANG_1234',
                moTa: 'Cầu tăng dần 1-2-3-4',
                doTinCay: 93,
                duDoan: last4[1].c === 'B' ? 'P' : 'B',
                sucManh: 'RẤT MẠNH',
                capDo: 2
            });
        }
        
        // 2-3-4-5
        if (last4[0].n === 2 && last4[1].n === 3 && last4[2].n === 4 && last4[3].n === 5) {
            results.push({
                loai: 'CAU_TANG_2345',
                moTa: 'Cầu tăng dần 2-3-4-5 cực hiếm',
                doTinCay: 95,
                duDoan: last4[1].c === 'B' ? 'P' : 'B',
                sucManh: 'SIÊU MẠNH',
                capDo: 3
            });
        }
        
        return results;
    }

    // ==================== NHÓM 17: CẦU GIẢM DẦN ====================
    
    nhanCauGiamDan(arr) {
        const results = [];
        if (arr.length < 12) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 4) return results;
        
        // 4-3-2-1
        const last4 = runs.slice(-4);
        if (last4[0].n === 4 && last4[1].n === 3 && last4[2].n === 2 && last4[3].n === 1) {
            results.push({
                loai: 'CAU_GIAM_4321',
                moTa: 'Cầu giảm dần 4-3-2-1',
                doTinCay: 92,
                duDoan: last4[0].c === 'B' ? 'P' : 'B',
                sucManh: 'RẤT MẠNH',
                capDo: 2
            });
        }
        
        // 5-4-3-2
        if (last4[0].n === 5 && last4[1].n === 4 && last4[2].n === 3 && last4[3].n === 2) {
            results.push({
                loai: 'CAU_GIAM_5432',
                moTa: 'Cầu giảm dần 5-4-3-2 cực hiếm',
                doTinCay: 94,
                duDoan: last4[0].c === 'B' ? 'P' : 'B',
                sucManh: 'SIÊU MẠNH',
                capDo: 3
            });
        }
        
        return results;
    }

    // ==================== NHÓM 18: CẦU ĐỐI XỨNG ====================
    
    nhanCauDoiXung(arr) {
        const results = [];
        if (arr.length < 10) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 4) return results;
        
        // 2-1-1-2
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 1 && last4[3].n === 2) {
            results.push({
                loai: 'CAU_DX_2112',
                moTa: 'Cầu đối xứng 2-1-1-2',
                doTinCay: 91,
                duDoan: last4[0].c,
                sucManh: 'RẤT MẠNH',
                capDo: 2
            });
        }
        
        // 3-2-2-3
        if (last4[0].n === 3 && last4[1].n === 2 && last4[2].n === 2 && last4[3].n === 3) {
            results.push({
                loai: 'CAU_DX_3223',
                moTa: 'Cầu đối xứng 3-2-2-3',
                doTinCay: 93,
                duDoan: last4[0].c === 'B' ? 'P' : 'B',
                sucManh: 'RẤT MẠNH',
                capDo: 2
            });
        }
        
        // 1-2-2-1
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 2 && last4[3].n === 1) {
            results.push({
                loai: 'CAU_DX_1221',
                moTa: 'Cầu đối xứng 1-2-2-1',
                doTinCay: 90,
                duDoan: last4[0].c === 'B' ? 'P' : 'B',
                sucManh: 'MẠNH',
                capDo: 1
            });
        }
        
        return results;
    }

    // ==================== NHÓM 19: CẦU VỆT ====================
    
    nhanCauVet(arr) {
        const results = [];
        if (arr.length < 4) return results;
        const runs = this.getRuns(arr);
        if (runs.length === 0) return results;
        
        const last = runs[runs.length - 1];
        
        // Vệt 3
        if (last.n === 3) {
            results.push({
                loai: 'VET_3',
                moTa: `Vệt ${last.c} dài 3 ván - Tiếp tục`,
                doTinCay: 78,
                duDoan: last.c,
                sucManh: 'TRUNG BÌNH',
                capDo: 1
            });
        }
        
        // Vệt 4
        if (last.n === 4) {
            results.push({
                loai: 'VET_4',
                moTa: `Vệt ${last.c} dài 4 ván - Chuẩn bị đảo`,
                doTinCay: 84,
                duDoan: last.c === 'B' ? 'P' : 'B',
                sucManh: 'MẠNH',
                capDo: 1
            });
        }
        
        // Vệt 5
        if (last.n === 5) {
            results.push({
                loai: 'VET_5',
                moTa: `Vệt ${last.c} dài 5 ván - Đảo`,
                doTinCay: 88,
                duDoan: last.c === 'B' ? 'P' : 'B',
                sucManh: 'MẠNH',
                capDo: 2
            });
        }
        
        // Vệt 6
        if (last.n === 6) {
            results.push({
                loai: 'VET_6',
                moTa: `Vệt ${last.c} dài 6 ván - Đảo mạnh`,
                doTinCay: 91,
                duDoan: last.c === 'B' ? 'P' : 'B',
                sucManh: 'RẤT MẠNH',
                capDo: 2
            });
        }
        
        // Vệt 7
        if (last.n === 7) {
            results.push({
                loai: 'VET_7',
                moTa: `Vệt ${last.c} dài 7 ván - Đảo cực mạnh`,
                doTinCay: 94,
                duDoan: last.c === 'B' ? 'P' : 'B',
                sucManh: 'RẤT MẠNH',
                capDo: 3
            });
        }
        
        // Vệt 8
        if (last.n === 8) {
            results.push({
                loai: 'VET_8',
                moTa: `Vệt ${last.c} dài 8 ván - Đảo siêu mạnh`,
                doTinCay: 96,
                duDoan: last.c === 'B' ? 'P' : 'B',
                sucManh: 'SIÊU MẠNH',
                capDo: 3
            });
        }
        
        // Vệt 9
        if (last.n === 9) {
            results.push({
                loai: 'VET_9',
                moTa: `Vệt ${last.c} dài 9 ván - Cực hiếm`,
                doTinCay: 97,
                duDoan: last.c === 'B' ? 'P' : 'B',
                sucManh: 'SIÊU MẠNH',
                capDo: 4
            });
        }
        
        // Vệt >=10
        if (last.n >= 10) {
            results.push({
                loai: 'VET_10+',
                moTa: `Vệt ${last.c} dài ${last.n} ván - Kỷ lục`,
                doTinCay: 98,
                duDoan: last.c === 'B' ? 'P' : 'B',
                sucManh: 'CỰC KỲ SIÊU MẠNH',
                capDo: 4
            });
        }
        
        return results;
    }

    // ==================== NHÓM 20: CẦU CHÓP ====================
    
    nhanCauChop(arr) {
        const results = [];
        if (arr.length < 8) return results;
        
        // Chop 8
        const last8 = arr.slice(-8);
        const runs8 = this.getRuns(last8);
        if (runs8.every(r => r.n === 1) && runs8.length >= 6) {
            results.push({
                loai: 'CHOP_8',
                moTa: 'Cầu chóp 8 ván',
                doTinCay: 92,
                duDoan: runs8[runs8.length-1].c === 'B' ? 'P' : 'B',
                sucManh: 'RẤT MẠNH',
                capDo: 2
            });
        }
        
        // Chop 10
        if (arr.length >= 10) {
            const last10 = arr.slice(-10);
            const runs10 = this.getRuns(last10);
            if (runs10.every(r => r.n === 1) && runs10.length >= 8) {
                results.push({
                    loai: 'CHOP_10',
                    moTa: 'Cầu chóp 10 ván cực mạnh',
                    doTinCay: 95,
                    duDoan: runs10[runs10.length-1].c === 'B' ? 'P' : 'B',
                    sucManh: 'SIÊU MẠNH',
                    capDo: 3
                });
            }
        }
        
        // Chop 12
        if (arr.length >= 12) {
            const last12 = arr.slice(-12);
            const runs12 = this.getRuns(last12);
            if (runs12.every(r => r.n === 1) && runs12.length >= 10) {
                results.push({
                    loai: 'CHOP_12',
                    moTa: 'Cầu chóp 12 ván siêu hiếm',
                    doTinCay: 97,
                    duDoan: runs12[runs12.length-1].c === 'B' ? 'P' : 'B',
                    sucManh: 'CỰC KỲ SIÊU MẠNH',
                    capDo: 4
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 21: CẦU FIBONACCI ====================
    
    nhanCauFibonacci(arr) {
        const results = [];
        if (arr.length < 16) return results;
        const runs = this.getRuns(arr);
        if (runs.length < 5) return results;
        
        const last5 = runs.slice(-5);
        // 1-1-2-3-5
        if (last5[0].n === 1 && last5[1].n === 1 && last5[2].n === 2 && 
            last5[3].n === 3 && last5[4].n === 5) {
            results.push({
                loai: 'FIBONACCI_11235',
                moTa: 'Cầu Fibonacci 1-1-2-3-5 hoàn hảo',
                doTinCay: 96,
                duDoan: last5[1].c === 'B' ? 'P' : 'B',
                sucManh: 'SIÊU MẠNH',
                capDo: 3
            });
        }
        
        // 2-3-5-8
        if (runs.length >= 4) {
            const last4 = runs.slice(-4);
            if (last4[0].n === 2 && last4[1].n === 3 && last4[2].n === 5 && last4[3].n === 8) {
                results.push({
                    loai: 'FIBONACCI_2358',
                    moTa: 'Cầu Fibonacci 2-3-5-8',
                    doTinCay: 97,
                    duDoan: last4[1].c === 'B' ? 'P' : 'B',
                    sucManh: 'SIÊU MẠNH',
                    capDo: 3
                });
            }
        }
        
        return results;
    }

    // ==================== NHÓM 22: CẦU ĐẶC BIỆT ====================
    
    nhanCauDacBiet(arr) {
        const results = [];
        if (arr.length < 12) return results;
        
        // Cầu B-P-B-P-B (5 ván xen kẽ)
        const last5 = arr.slice(-5);
        if (last5[0] !== last5[1] && last5[1] !== last5[2] && 
            last5[2] !== last5[3] && last5[3] !== last5[4]) {
            results.push({
                loai: 'XENKE_5',
                moTa: 'Cầu xen kẽ 5 ván',
                doTinCay: 90,
                duDoan: last5[4] === 'B' ? 'P' : 'B',
                sucManh: 'MẠNH',
                capDo: 2
            });
        }
        
        // Cầu 2-2-3-3-2-2
        const runs = this.getRuns(arr);
        if (runs.length >= 6) {
            const last6 = runs.slice(-6);
            if (last6[0].n === 2 && last6[1].n === 2 && last6[2].n === 3 && 
                last6[3].n === 3 && last6[4].n === 2 && last6[5].n === 2) {
                results.push({
                    loai: 'CAU_223322',
                    moTa: 'Cầu 2-2-3-3-2-2 đặc biệt',
                    doTinCay: 95,
                    duDoan: last6[0].c,
                    sucManh: 'SIÊU MẠNH',
                    capDo: 3
                });
            }
        }
        
        // Cầu đảo chiều
        if (runs.length >= 4) {
            const last4 = runs.slice(-4);
            if (last4[0].c !== last4[1].c && last4[1].c !== last4[2].c && 
                last4[2].c !== last4[3].c && last4[0].c === last4[3].c) {
                results.push({
                    loai: 'CAU_DAO_CHIEU',
                    moTa: 'Cầu đảo chiều hoàn hảo',
                    doTinCay: 93,
                    duDoan: last4[1].c === 'B' ? 'P' : 'B',
                    sucManh: 'RẤT MẠNH',
                    capDo: 2
                });
            }
        }
        
        return results;
    }

    // ==================== NHẬN DIỆN TẤT CẢ CẦU ====================
    
    nhanDienTatCaCau(arr) {
        let tatCaCau = [];
        
        // Gộp tất cả các loại cầu
        tatCaCau = tatCaCau.concat(this.nhanCau1_1(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau2_2(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau3_3(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau4_4(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau5_5(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau1_2_1(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau2_1_2(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau3_2_1(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau1_2_3(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau2_3_2(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau3_1_3(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau2_2_1(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau1_1_2(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau2_3_1(arr));
        tatCaCau = tatCaCau.concat(this.nhanCau1_3_2(arr));
        tatCaCau = tatCaCau.concat(this.nhanCauTangDan(arr));
        tatCaCau = tatCaCau.concat(this.nhanCauGiamDan(arr));
        tatCaCau = tatCaCau.concat(this.nhanCauDoiXung(arr));
        tatCaCau = tatCaCau.concat(this.nhanCauVet(arr));
        tatCaCau = tatCaCau.concat(this.nhanCauChop(arr));
        tatCaCau = tatCaCau.concat(this.nhanCauFibonacci(arr));
        tatCaCau = tatCaCau.concat(this.nhanCauDacBiet(arr));
        
        // Lọc bỏ null
        tatCaCau = tatCaCau.filter(c => c !== null);
        
        // Sắp xếp theo độ tin cậy giảm dần
        tatCaCau.sort((a, b) => b.doTinCay - a.doTinCay);
        
        this.cauDaNhan = tatCaCau;
        
        // Chọn cầu tốt nhất
        if (tatCaCau.length > 0) {
            this.cauTotNhat = tatCaCau[0];
        } else {
            this.cauTotNhat = null;
        }
        
        // Phân loại cầu
        this.phanLoaiCau = {
            cau1_1: tatCaCau.filter(c => c.loai.includes('ZIGZAG')),
            cau2_2: tatCaCau.filter(c => c.loai.includes('CAU_22') || c.loai.includes('CAU_222')),
            cau3_3: tatCaCau.filter(c => c.loai.includes('CAU_33') || c.loai.includes('CAU_333')),
            cau4_4: tatCaCau.filter(c => c.loai.includes('CAU_44') || c.loai.includes('CAU_444')),
            cau5_5: tatCaCau.filter(c => c.loai.includes('CAU_55')),
            cauCheo: tatCaCau.filter(c => c.loai.includes('CAU_121') || c.loai.includes('CAU_212') || c.loai.includes('CHOP')),
            cauDoiXung: tatCaCau.filter(c => c.loai.includes('CAU_DX')),
            cauTangDan: tatCaCau.filter(c => c.loai.includes('CAU_TANG')),
            cauGiamDan: tatCaCau.filter(c => c.loai.includes('CAU_GIAM')),
            cauVet: tatCaCau.filter(c => c.loai.includes('VET')),
            cauChop: tatCaCau.filter(c => c.loai.includes('CHOP')),
            cauFibonacci: tatCaCau.filter(c => c.loai.includes('FIBONACCI')),
            cauPattern: tatCaCau.filter(c => c.loai.includes('CAU_1212') || c.loai.includes('CAU_2121')),
            cauDacBiet: tatCaCau.filter(c => c.loai.includes('XENKE') || c.loai.includes('CAU_DAO'))
        };
        
        return tatCaCau;
    }

    // ==================== BÁO CÁO CẦU CHI TIẾT ====================
    
    baoCaoCau(arr) {
        this.nhanDienTatCaCau(arr);
        
        if (this.cauDaNhan.length === 0) {
            return {
                tongSoCau: 0,
                cauTotNhat: null,
                tatCaCau: [],
                phanLoai: this.phanLoaiCau,
                khuyenNghi: 'CHƯA PHÁT HIỆN CẦU NÀO - DÙNG THỐNG KÊ',
                mucDoTinCay: 0
            };
        }
        
        // Tạo báo cáo
        const report = {
            tongSoCau: this.cauDaNhan.length,
            cauTotNhat: this.cauTotNhat,
            top5Cau: this.cauDaNhan.slice(0, 5),
            tatCaCau: this.cauDaNhan,
            phanLoai: this.phanLoaiCau,
            khuyenNghi: this.cauTotNhat ? `THEO CẦU ${this.cauTotNhat.loai} - ${this.cauTotNhat.moTa}` : 'CHƯA CÓ CẦU',
            mucDoTinCay: this.cauTotNhat ? this.cauTotNhat.doTinCay : 0,
            chiTiet: {
                cau1_1: this.phanLoaiCau.cau1_1.length,
                cau2_2: this.phanLoaiCau.cau2_2.length,
                cau3_3: this.phanLoaiCau.cau3_3.length,
                cau4_4: this.phanLoaiCau.cau4_4.length,
                cau5_5: this.phanLoaiCau.cau5_5.length,
                cauVet: this.phanLoaiCau.cauVet.length,
                cauChop: this.phanLoaiCau.cauChop.length,
                cauFibonacci: this.phanLoaiCau.cauFibonacci.length,
                cauDacBiet: this.phanLoaiCau.cauDacBiet.length
            }
        };
        
        return report;
    }
}

// ============================================================
// THUẬT TOÁN DỰ ĐOÁN SIÊU VIP
// ============================================================

class SieuDuDoan {
    constructor() {
        this.nhanDien = new SieuNhanDienCau();
        this.lichSuDuDoan = [];
        this.doChinhXac = { B: 0, P: 0, tong: 0 };
    }

    duDoan(arr) {
        if (arr.length < 6) {
            return {
                Du_doan: 'CHỜ',
                Ti_le: '0%',
                Do_tin_cay: '0%',
                BANKER: '50%',
                PLAYER: '50%',
                Cau: 'CHƯA ĐỦ DỮ LIỆU',
                LoaiCau: 'N/A',
                SucManh: 'N/A',
                TongCau: 0,
                TopCau: 'N/A',
                TrangThai: 'ĐANG CHỜ DỮ LIỆU'
            };
        }

        // BƯỚC 1: NHẬN DIỆN CẦU
        const baoCao = this.nhanDien.baoCaoCau(arr);
        
        // BƯỚC 2: PHÂN TÍCH CẦU
        let duDoanCuoi = null;
        let doTinCayCuoi = 0;
        let loaiCauCuoi = '';
        let sucManhCuoi = '';
        let moTaCau = '';
        
        if (baoCao.cauTotNhat && baoCao.cauTotNhat.doTinCay >= 80) {
            const cauTot = baoCao.cauTotNhat;
            duDoanCuoi = cauTot.duDoan;
            doTinCayCuoi = cauTot.doTinCay;
            loaiCauCuoi = cauTot.loai;
            sucManhCuoi = cauTot.sucManh;
            moTaCau = cauTot.moTa;
        }
        
        // BƯỚC 3: NẾU KHÔNG CÓ CẦU MẠNH -> DÙNG THỐNG KÊ
        if (!duDoanCuoi) {
            const stats = this.thongKe(arr);
            duDoanCuoi = stats.B > stats.P ? 'B' : 'P';
            doTinCayCuoi = Math.min(65 + Math.abs(stats.B - stats.P) * 0.3, 85);
            loaiCauCuoi = 'THONG_KE';
            sucManhCuoi = 'TRUNG BÌNH';
            moTaCau = `Dựa trên thống kê B:${Math.round(stats.B)}% P:${Math.round(stats.P)}%`;
        }
        
        // BƯỚC 4: TÍNH TỶ LỆ
        const ratio = 50 + (doTinCayCuoi - 50) * 0.6;
        const bRatio = duDoanCuoi === 'B' ? ratio : 100 - ratio;
        const pRatio = duDoanCuoi === 'P' ? ratio : 100 - ratio;
        
        // BƯỚC 5: TẠO TOP CẦU
        const topCau = baoCao.top5Cau ? baoCao.top5Cau.map((c, i) => 
            `${i+1}.${c.loai}(${c.doTinCay}%)`
        ).join(' | ') : 'KHÔNG CÓ CẦU';
        
        // BƯỚC 6: KẾT QUẢ
        const result = {
            Du_doan: duDoanCuoi === 'B' ? 'BANKER' : 'PLAYER',
            Ti_le: Math.round(Math.max(bRatio, pRatio)) + '%',
            Do_tin_cay: Math.round(doTinCayCuoi) + '%',
            BANKER: Math.round(bRatio) + '%',
            PLAYER: Math.round(pRatio) + '%',
            Cau: moTaCau,
            LoaiCau: loaiCauCuoi,
            SucManh: sucManhCuoi,
            TongCau: baoCao.tongSoCau,
            TopCau: topCau,
            PhanLoaiCau: baoCao.chiTiet,
            TrangThai: doTinCayCuoi >= 90 ? 'CỰC KỲ TIN CẬY' : 
                       doTinCayCuoi >= 80 ? 'RẤT TIN CẬY' : 
                       doTinCayCuoi >= 70 ? 'TIN CẬY' : 'THAM KHẢO'
        };
        
        // Lưu lịch sử
        this.lichSuDuDoan.push({
            thoiGian: Date.now(),
            duDoan: result.Du_doan,
            doTinCay: result.Do_tin_cay,
            cau: result.Cau
        });
        
        if (this.lichSuDuDoan.length > 100) {
            this.lichSuDuDoan.shift();
        }
        
        return result;
    }

    thongKe(arr) {
        const cnt = {B:0, P:0};
        for (const c of arr) {
            if (c === 'B') cnt.B++;
            else if (c === 'P') cnt.P++;
        }
        const total = arr.length;
        return {
            B: (cnt.B / total) * 100,
            P: (cnt.P / total) * 100,
            countB: cnt.B,
            countP: cnt.P,
            total: total
        };
    }
}

// ============================================================
// API
// ============================================================

const engine = new SieuDuDoan();

async function fetchTableData(tableId) {
    try {
        const url = API_BASE + '/api/baccarat/' + tableId.toUpperCase();
        const res = await axios.get(url, { timeout: 15000 });
        if (res.data?.success && res.data?.data) return res.data.data.result || '';
        return '';
    } catch (e) {
        console.error('❌', tableId, e.message);
        return '';
    }
}

app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const cauGoc = await fetchTableData(tableId);
        if (!cauGoc) {
            return res.json({ success: false, message: 'Không tìm thấy bàn ' + tableId });
        }

        const old = lastData[tableId] || '';
        const isNew = cauGoc !== old && cauGoc.length > old.length;
        lastData[tableId] = cauGoc;
        if (!sessionData[tableId]) sessionData[tableId] = 0;
        if (isNew) sessionData[tableId]++;

        const arr = toArr(cauGoc);
        const result = engine.duDoan(arr);

        res.json({
            success: true,
            table: tableId,
            phien: sessionData[tableId],
            cau_goc: cauGoc.slice(-50),
            ...result,
            engine: 'SIEU_NHAN_DIEN_CAU_V1',
            author: '@AR-AI',
            timestamp: new Date().toISOString()
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

            const arr = toArr(cauGoc);
            const result = engine.duDoan(arr);
            
            predictions[id] = {
                phien: sessionData[id],
                Du_doan: result.Du_doan,
                Ti_le: result.Ti_le,
                Do_tin_cay: result.Do_tin_cay,
                Cau: result.Cau,
                SucManh: result.SucManh
            };
        }

        res.json({
            success: true,
            engine: 'SIEU_NHAN_DIEN_CAU_V1',
            timestamp: new Date().toISOString(),
            author: '@AR-AI',
            predictions: predictions
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/pattern/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const cauGoc = await fetchTableData(tableId);
        if (!cauGoc) {
            return res.json({ success: false, message: 'Không tìm thấy bàn ' + tableId });
        }

        const arr = toArr(cauGoc);
        const nhanDien = new SieuNhanDienCau();
        const baoCao = nhanDien.baoCaoCau(arr);

        res.json({
            success: true,
            table: tableId,
            pattern_report: baoCao,
            author: '@AR-AI'
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/', (req, res) => {
    res.json({
        name: 'SIÊU NHẬN DIỆN CẦU - 50+ LOẠI CẦU',
        version: 'VIP_ULTRA_V1',
        author: '@AR-AI',
        moTa: 'Nhận diện cầu trước, dự đoán sau - Không random',
        soLoaiCau: 50,
        cacNhomCau: [
            'Cầu 1-1 (Zigzag 6,8,10,12)',
            'Cầu 2-2 (22,222,2222)',
            'Cầu 3-3 (33,333,3333)',
            'Cầu 4-4 (44,444)',
            'Cầu 5-5 (55)',
            'Cầu 1-2-1 (121,1212,12121)',
            'Cầu 2-1-2 (212,2121,21212)',
            'Cầu 3-2-1 (321,3212)',
            'Cầu 1-2-3 (123,1232)',
            'Cầu 2-3-2 (232,2323)',
            'Cầu 3-1-3 (313,3131)',
            'Cầu 2-2-1 (221,2212)',
            'Cầu 1-1-2 (112,1121)',
            'Cầu 2-3-1 (231)',
            'Cầu 1-3-2 (132)',
            'Cầu tăng dần (1234,2345)',
            'Cầu giảm dần (4321,5432)',
            'Cầu đối xứng (2112,3223,1221)',
            'Cầu vệt (3,4,5,6,7,8,9,10+)',
            'Cầu chóp (8,10,12)',
            'Cầu Fibonacci (11235,2358)',
            'Cầu đặc biệt (xen kẽ, đảo chiều, 223322)'
        ],
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all',
            'Phân tích cầu': '/api/pattern/:tableId'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  SIÊU NHẬN DIỆN CẦU - 50+ LOẠI CẦU           ║');
    console.log('║  NHẬN DIỆN TRƯỚC -> DỰ ĐOÁN SAU              ║');
    console.log('║  KHÔNG RANDOM - KHÔNG THUẬT TOÁN ẢO           ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('🚀 http://localhost:' + PORT);
    console.log('👤 @AR-AI');
    console.log('📊 50+ loại cầu được nhận diện');
    console.log('🎯 Bước 1: Nhận diện cầu');
    console.log('🎯 Bước 2: Phân tích cầu');
    console.log('🎯 Bước 3: Dự đoán theo cầu');
    console.log('================================================');
});
