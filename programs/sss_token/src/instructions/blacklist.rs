use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use crate::state::{StablecoinState, Blacklist};
use crate::errors::StablecoinError;

#[derive(Accounts)]
pub struct AddToBlacklist<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    #[account(
        seeds = [b"state", mint.key().as_ref()],
        bump,
        has_one = blacklister @ StablecoinError::UnauthorizedBlacklister
    )]
    pub state: Account<'info, StablecoinState>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: The account to be blacklisted
    pub target_account: AccountInfo<'info>,

    #[account(
        init,
        payer = blacklister,
        space = Blacklist::MAX_SIZE,
        seeds = [b"blacklist", mint.key().as_ref(), target_account.key().as_ref()],
        bump
    )]
    pub blacklist: Account<'info, Blacklist>,

    pub system_program: Program<'info, System>,
}

pub fn process_add_to_blacklist(ctx: Context<AddToBlacklist>) -> Result<()> {
    let blacklist = &mut ctx.accounts.blacklist;
    blacklist.is_blacklisted = true;
    msg!("Account {} added to blacklist", ctx.accounts.target_account.key());
    Ok(())
}

#[derive(Accounts)]
pub struct RemoveFromBlacklist<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    #[account(
        seeds = [b"state", mint.key().as_ref()],
        bump,
        has_one = blacklister @ StablecoinError::UnauthorizedBlacklister
    )]
    pub state: Account<'info, StablecoinState>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: The account to be removed from blacklist
    pub target_account: AccountInfo<'info>,

    #[account(
        mut,
        close = blacklister,
        seeds = [b"blacklist", mint.key().as_ref(), target_account.key().as_ref()],
        bump
    )]
    pub blacklist: Account<'info, Blacklist>,
}

pub fn process_remove_from_blacklist(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
    msg!("Account {} removed from blacklist. PDA closed.", ctx.accounts.target_account.key());
    Ok(())
}
