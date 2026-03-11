use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use crate::state::StablecoinState;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub master_authority: Signer<'info>,

    #[account(
        init,
        payer = master_authority,
        space = StablecoinState::MAX_SIZE,
        seeds = [b"state", mint.key().as_ref()],
        bump
    )]
    pub state: Account<'info, StablecoinState>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
}

pub fn process_initialize(
    ctx: Context<Initialize>,
    minters: Vec<Pubkey>,
    burner: Pubkey,
    pauser: Pubkey,
    blacklister: Pubkey,
) -> Result<()> {
    let state = &mut ctx.accounts.state;
    state.mint = ctx.accounts.mint.key();
    state.master_authority = ctx.accounts.master_authority.key();
    state.minters = minters;
    state.burner = burner;
    state.pauser = pauser;
    state.blacklister = blacklister;
    state.is_paused = false;

    Ok(())
}
