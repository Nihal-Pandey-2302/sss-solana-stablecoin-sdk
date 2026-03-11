use anchor_lang::prelude::*;

#[account]
pub struct StablecoinState {
    pub mint: Pubkey,
    pub master_authority: Pubkey,
    pub minters: Vec<Pubkey>,
    pub burner: Pubkey,
    pub pauser: Pubkey,
    pub blacklister: Pubkey,
    pub is_paused: bool,
}

impl StablecoinState {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + (4 + 32 * 10) + 32 + 32 + 32 + 1;
}

#[account]
pub struct Blacklist {
    pub is_blacklisted: bool,
}

impl Blacklist {
    pub const MAX_SIZE: usize = 8 + 1;
}
