use anchor_lang::prelude::*;

#[error_code]
pub enum StablecoinError {
    #[msg("Unauthorized: Minters only")]
    UnauthorizedMinter,
    #[msg("Unauthorized: Burners only")]
    UnauthorizedBurner,
    #[msg("Unauthorized: Freeze authority only")]
    UnauthorizedFreezer,
    #[msg("Unauthorized: Master authority only")]
    UnauthorizedMaster,
    #[msg("Unauthorized: Blacklisters only")]
    UnauthorizedBlacklister,
    #[msg("Token operations are currently paused")]
    TokenPaused,
    #[msg("Sender is blacklisted")]
    SenderBlacklisted,
    #[msg("Recipient is blacklisted")]
    RecipientBlacklisted,
    #[msg("Minter quota exceeded for this period")]
    MinterQuotaExceeded,
}

