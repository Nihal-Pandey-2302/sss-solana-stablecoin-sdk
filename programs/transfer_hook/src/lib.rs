use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{Mint, TokenAccount},
};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

declare_id!("DyHpthHQhvcuywjyV4nBjpEZbM1PfP71wAn84nkVshUy");

#[program]
pub mod transfer_hook {
    use super::*;

    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        // We define TWO extra accounts to be appended to all transfer instructions:
        // 1. Blacklist PDA for the `source` account (index 0)
        // 2. Blacklist PDA for the `destination` account (index 2)
        let sss_token_program_id = pubkey!("F7igqZa75yYPnXBBKUK3hDwEmtfwUWogEcWMsh5v6FyR");

        let account_metas = vec![
            ExtraAccountMeta::new_with_pubkey(&sss_token_program_id, false, false)?, // extra account 0: sss_token program id
            ExtraAccountMeta::new_external_pda_with_seeds(
                5, // index 5 points to the sss_token_program_id
                &[
                    Seed::Literal { bytes: b"blacklist".to_vec() },
                    Seed::AccountKey { index: 1 }, // mint 
                    Seed::AccountKey { index: 0 }, // source
                ],
                false, // is_signer 
                false, // is_writable
            )?,
            ExtraAccountMeta::new_external_pda_with_seeds(
                5,
                &[
                    Seed::Literal { bytes: b"blacklist".to_vec() },
                    Seed::AccountKey { index: 1 }, // mint 
                    Seed::AccountKey { index: 2 }, // destination
                ],
                false, // is_signer 
                false, // is_writable
            )?,
        ];

        let account_size = ExtraAccountMetaList::size_of(account_metas.len())?;
        let lamports = Rent::get()?.minimum_balance(account_size);

        let mint = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"extra-account-metas",
            &mint.as_ref(),
            &[ctx.bumps.extra_account_meta_list],
        ]];
        
        anchor_lang::system_program::create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info(),
                },
                signer_seeds,
            ),
            lamports,
            account_size as u64,
            ctx.program_id,
        )?;

        let mut data = ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?;
        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut data,
            &account_metas,
        )?;

        Ok(())
    }

    pub fn fallback<'info>(_program_id: &Pubkey, accounts: &'info [AccountInfo<'info>], ix_data: &[u8]) -> Result<()> {
        // We assume 5: sss_token, 6: src_blacklist, 7: dest_blacklist based on account metas
        if accounts.len() >= 8 {
            let source_blacklist = &accounts[6];
            let destination_blacklist = &accounts[7];

            if !source_blacklist.data_is_empty() {
                msg!("Transfer blocked: Source account is blacklisted!");
                return Err(ProgramError::Custom(17).into()); 
            }

            if !destination_blacklist.data_is_empty() {
                msg!("Transfer blocked: Destination account is blacklisted!");
                return Err(ProgramError::Custom(18).into()); 
            }
        }
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Validated automatically
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Execute<'info> {
    pub source: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub authority: Signer<'info>,

    /// CHECK: Checked by ExtraAccountMetaList automatically
    #[account(
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    /// CHECK: We receive the Token-2022 program here
    pub token_program: AccountInfo<'info>,

    /// CHECK: Program ID of sss_token passed from resolution
    pub sss_token_program: AccountInfo<'info>,

    /// CHECK: Checked by custom logic
    #[account(
        seeds = [b"blacklist", mint.key().as_ref(), source.key().as_ref()],
        seeds::program = sss_token_program.key(),
        bump
    )]
    pub source_blacklist: AccountInfo<'info>,

    /// CHECK: Checked by custom logic
    #[account(
        seeds = [b"blacklist", mint.key().as_ref(), destination.key().as_ref()],
        seeds::program = sss_token_program.key(),
        bump
    )]
    pub destination_blacklist: AccountInfo<'info>,
}


