use anchor_lang::prelude::*;
use crate::state::StablecoinState;
use crate::errors::StablecoinError;

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    pub master_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"state", mint.key().as_ref()],
        bump,
        has_one = master_authority @ StablecoinError::UnauthorizedMaster
    )]
    pub state: Account<'info, StablecoinState>,

    pub mint: InterfaceAccount<'info, anchor_spl::token_interface::Mint>,
}

pub fn process_transfer_authority(
    ctx: Context<TransferAuthority>,
    new_master: Option<Pubkey>,
    new_minters: Option<Vec<Pubkey>>,
    new_burner: Option<Pubkey>,
    new_pauser: Option<Pubkey>,
    new_blacklister: Option<Pubkey>,
) -> Result<()> {
    let state = &mut ctx.accounts.state;
    if let Some(master) = new_master { state.master_authority = master; }
    if let Some(minters) = new_minters { state.minters = minters; }
    if let Some(burner) = new_burner { state.burner = burner; }
    if let Some(pauser) = new_pauser { state.pauser = pauser; }
    if let Some(blacklister) = new_blacklister { state.blacklister = blacklister; }
    Ok(())
}
