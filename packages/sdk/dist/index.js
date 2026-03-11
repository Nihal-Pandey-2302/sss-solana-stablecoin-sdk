"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolanaStablecoin = exports.Preset = void 0;
const anchor = __importStar(require("@coral-xyz/anchor"));
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const sss_token_json_1 = __importDefault(require("./idl/sss_token.json"));
const transfer_hook_json_1 = __importDefault(require("./idl/transfer_hook.json"));
var Preset;
(function (Preset) {
    Preset["SSS1"] = "SSS1";
    Preset["SSS2"] = "SSS2";
})(Preset || (exports.Preset = Preset = {}));
class SolanaStablecoin {
    constructor(connection, wallet, programId, hookProgramId) {
        this.connection = connection;
        const provider = new anchor.AnchorProvider(connection, wallet, {
            preflightCommitment: "confirmed",
        });
        const defaultProgramId = new web3_js_1.PublicKey("DyHpthHQhvcuywjyV4nBjpEZbM1PfP71wAn84nkVshUy");
        const defaultHookProgramId = new web3_js_1.PublicKey("F7igqZa75yYPnXBBKUK3hDwEmtfwUWogEcWMsh5v6FyR");
        this.program = new anchor_1.Program(sss_token_json_1.default, provider);
        this.hookProgram = new anchor_1.Program(transfer_hook_json_1.default, provider);
    }
    /**
     * Returns the required Token-2022 Extensions required for a preset.
     */
    static getExtensions(preset) {
        switch (preset) {
            case Preset.SSS1:
                return [];
            case Preset.SSS2:
                return [spl_token_1.ExtensionType.TransferHook, spl_token_1.ExtensionType.PermanentDelegate];
            default:
                return [];
        }
    }
    /**
     * Derives the state PDA for the given mint.
     */
    getStatePda(mint) {
        const [statePda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("state"), mint.toBuffer()], this.program.programId);
        return statePda;
    }
    /**
     * Fetches the on-chain StablecoinState data.
     */
    async getState(mint) {
        const statePda = this.getStatePda(mint);
        return await this.program.account.stablecoinState.fetch(statePda);
    }
    /**
     * Derives the Blacklist PDA for a specific Token Account.
     */
    getBlacklistPda(mint, targetAta) {
        const [pda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("blacklist"), mint.toBuffer(), targetAta.toBuffer()], this.program.programId);
        return pda;
    }
}
exports.SolanaStablecoin = SolanaStablecoin;
__exportStar(require("./defineStablecoin"), exports);
__exportStar(require("./sss1"), exports);
__exportStar(require("./sss2"), exports);
