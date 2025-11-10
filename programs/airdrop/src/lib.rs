use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod airdrop {
    use super::*;

    /// Initialize a new airdrop campaign
    pub fn initialize_airdrop(
        ctx: Context<InitializeAirdrop>,
        total_supply: u64,
        tokens_per_claim: u64,
        start_time: i64,
        end_time: i64,
        whitelist_only: bool,
    ) -> Result<()> {
        let airdrop = &mut ctx.accounts.airdrop;

        require!(total_supply > 0, AirdropError::InvalidSupply);
        require!(tokens_per_claim > 0, AirdropError::InvalidClaimAmount);
        require!(start_time < end_time, AirdropError::InvalidTimeWindow);

        airdrop.authority = ctx.accounts.authority.key();
        airdrop.token_mint = ctx.accounts.token_mint.key();
        airdrop.token_vault = ctx.accounts.token_vault.key();
        airdrop.total_supply = total_supply;
        airdrop.tokens_distributed = 0;
        airdrop.tokens_per_claim = tokens_per_claim;
        airdrop.start_time = start_time;
        airdrop.end_time = end_time;
        airdrop.is_paused = false;
        airdrop.whitelist_only = whitelist_only;
        airdrop.bump = ctx.bumps.airdrop;

        emit!(AirdropInitialized {
            airdrop: airdrop.key(),
            authority: airdrop.authority,
            total_supply,
            tokens_per_claim,
        });

        Ok(())
    }

    /// Claim tokens from the airdrop
    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        let airdrop = &mut ctx.accounts.airdrop;
        let claim_record = &mut ctx.accounts.claim_record;
        let clock = Clock::get()?;

        // Check if airdrop is active
        require!(!airdrop.is_paused, AirdropError::AirdropPaused);

        // Check time window
        require!(
            clock.unix_timestamp >= airdrop.start_time,
            AirdropError::AirdropNotStarted
        );
        require!(
            airdrop.end_time == 0 || clock.unix_timestamp <= airdrop.end_time,
            AirdropError::AirdropEnded
        );

        // Check supply
        require!(
            airdrop.tokens_distributed + airdrop.tokens_per_claim <= airdrop.total_supply,
            AirdropError::SupplyExhausted
        );

        // Check if already claimed
        require!(!claim_record.has_claimed, AirdropError::AlreadyClaimed);

        // If whitelist mode, verify user is whitelisted
        if airdrop.whitelist_only {
            let whitelist_entry = &ctx.accounts.whitelist_entry;
            require!(
                whitelist_entry.is_some() && whitelist_entry.as_ref().unwrap().is_eligible,
                AirdropError::NotWhitelisted
            );
        }

        // Transfer tokens
        let seeds = &[
            b"airdrop",
            airdrop.token_mint.as_ref(),
            &[airdrop.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.token_vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: airdrop.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer(cpi_ctx, airdrop.tokens_per_claim)?;

        // Update records
        claim_record.user = ctx.accounts.user.key();
        claim_record.airdrop = airdrop.key();
        claim_record.amount_claimed = airdrop.tokens_per_claim;
        claim_record.claimed_at = clock.unix_timestamp;
        claim_record.has_claimed = true;
        claim_record.bump = ctx.bumps.claim_record;

        airdrop.tokens_distributed += airdrop.tokens_per_claim;

        emit!(TokensClaimed {
            user: ctx.accounts.user.key(),
            airdrop: airdrop.key(),
            amount: airdrop.tokens_per_claim,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Pause the airdrop
    pub fn pause_airdrop(ctx: Context<PauseAirdrop>) -> Result<()> {
        let airdrop = &mut ctx.accounts.airdrop;

        require!(!airdrop.is_paused, AirdropError::AlreadyPaused);

        airdrop.is_paused = true;

        emit!(AirdropPaused {
            airdrop: airdrop.key(),
            authority: ctx.accounts.authority.key(),
        });

        Ok(())
    }

    /// Resume the airdrop
    pub fn resume_airdrop(ctx: Context<ResumeAirdrop>) -> Result<()> {
        let airdrop = &mut ctx.accounts.airdrop;

        require!(airdrop.is_paused, AirdropError::NotPaused);

        airdrop.is_paused = false;

        emit!(AirdropResumed {
            airdrop: airdrop.key(),
            authority: ctx.accounts.authority.key(),
        });

        Ok(())
    }

    /// Add wallet to whitelist
    pub fn add_to_whitelist(ctx: Context<AddToWhitelist>) -> Result<()> {
        let whitelist_entry = &mut ctx.accounts.whitelist_entry;

        whitelist_entry.airdrop = ctx.accounts.airdrop.key();
        whitelist_entry.user = ctx.accounts.user.key();
        whitelist_entry.is_eligible = true;
        whitelist_entry.added_at = Clock::get()?.unix_timestamp;
        whitelist_entry.bump = ctx.bumps.whitelist_entry;

        emit!(WhitelistAdded {
            airdrop: ctx.accounts.airdrop.key(),
            user: ctx.accounts.user.key(),
        });

        Ok(())
    }

    /// Remove wallet from whitelist
    pub fn remove_from_whitelist(ctx: Context<RemoveFromWhitelist>) -> Result<()> {
        let whitelist_entry = &mut ctx.accounts.whitelist_entry;

        whitelist_entry.is_eligible = false;

        emit!(WhitelistRemoved {
            airdrop: ctx.accounts.airdrop.key(),
            user: ctx.accounts.user.key(),
        });

        Ok(())
    }

    /// Update airdrop configuration
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        tokens_per_claim: Option<u64>,
        end_time: Option<i64>,
        whitelist_only: Option<bool>,
    ) -> Result<()> {
        let airdrop = &mut ctx.accounts.airdrop;

        if let Some(amount) = tokens_per_claim {
            require!(amount > 0, AirdropError::InvalidClaimAmount);
            airdrop.tokens_per_claim = amount;
        }

        if let Some(time) = end_time {
            require!(time > airdrop.start_time, AirdropError::InvalidTimeWindow);
            airdrop.end_time = time;
        }

        if let Some(whitelist) = whitelist_only {
            airdrop.whitelist_only = whitelist;
        }

        emit!(ConfigUpdated {
            airdrop: airdrop.key(),
            authority: ctx.accounts.authority.key(),
        });

        Ok(())
    }

    /// Emergency withdraw remaining tokens
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        let airdrop = &ctx.accounts.airdrop;
        let token_vault = &ctx.accounts.token_vault;

        let seeds = &[
            b"airdrop",
            airdrop.token_mint.as_ref(),
            &[airdrop.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: token_vault.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: airdrop.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer(cpi_ctx, token_vault.amount)?;

        emit!(EmergencyWithdrawal {
            airdrop: airdrop.key(),
            authority: ctx.accounts.authority.key(),
            amount: token_vault.amount,
        });

        Ok(())
    }
}

// Accounts Structures

#[derive(Accounts)]
#[instruction(total_supply: u64, tokens_per_claim: u64)]
pub struct InitializeAirdrop<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Airdrop::LEN,
        seeds = [b"airdrop", token_mint.key().as_ref()],
        bump
    )]
    pub airdrop: Account<'info, Airdrop>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        constraint = token_vault.mint == token_mint.key(),
        constraint = token_vault.owner == airdrop.key(),
    )]
    pub token_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    #[account(
        mut,
        seeds = [b"airdrop", airdrop.token_mint.as_ref()],
        bump = airdrop.bump
    )]
    pub airdrop: Account<'info, Airdrop>,

    #[account(
        init,
        payer = user,
        space = 8 + ClaimRecord::LEN,
        seeds = [b"claim", airdrop.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub claim_record: Account<'info, ClaimRecord>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = token_vault.key() == airdrop.token_vault,
        constraint = token_vault.mint == airdrop.token_mint,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == airdrop.token_mint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// Whitelist entry (optional, only checked if whitelist_only is true)
    pub whitelist_entry: Option<Account<'info, WhitelistEntry>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct PauseAirdrop<'info> {
    #[account(
        mut,
        seeds = [b"airdrop", airdrop.token_mint.as_ref()],
        bump = airdrop.bump,
        has_one = authority
    )]
    pub airdrop: Account<'info, Airdrop>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResumeAirdrop<'info> {
    #[account(
        mut,
        seeds = [b"airdrop", airdrop.token_mint.as_ref()],
        bump = airdrop.bump,
        has_one = authority
    )]
    pub airdrop: Account<'info, Airdrop>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct AddToWhitelist<'info> {
    #[account(
        seeds = [b"airdrop", airdrop.token_mint.as_ref()],
        bump = airdrop.bump,
        has_one = authority
    )]
    pub airdrop: Account<'info, Airdrop>,

    #[account(
        init,
        payer = authority,
        space = 8 + WhitelistEntry::LEN,
        seeds = [b"whitelist", airdrop.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,

    /// CHECK: User to be whitelisted
    pub user: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveFromWhitelist<'info> {
    #[account(
        seeds = [b"airdrop", airdrop.token_mint.as_ref()],
        bump = airdrop.bump,
        has_one = authority
    )]
    pub airdrop: Account<'info, Airdrop>,

    #[account(
        mut,
        seeds = [b"whitelist", airdrop.key().as_ref(), user.key().as_ref()],
        bump = whitelist_entry.bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,

    /// CHECK: User to be removed from whitelist
    pub user: AccountInfo<'info>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"airdrop", airdrop.token_mint.as_ref()],
        bump = airdrop.bump,
        has_one = authority
    )]
    pub airdrop: Account<'info, Airdrop>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(
        seeds = [b"airdrop", airdrop.token_mint.as_ref()],
        bump = airdrop.bump,
        has_one = authority
    )]
    pub airdrop: Account<'info, Airdrop>,

    #[account(
        mut,
        constraint = token_vault.key() == airdrop.token_vault,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = destination.owner == authority.key(),
    )]
    pub destination: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// Account State Structures

#[account]
pub struct Airdrop {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub token_vault: Pubkey,
    pub total_supply: u64,
    pub tokens_distributed: u64,
    pub tokens_per_claim: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub is_paused: bool,
    pub whitelist_only: bool,
    pub bump: u8,
}

impl Airdrop {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1;
}

#[account]
pub struct ClaimRecord {
    pub user: Pubkey,
    pub airdrop: Pubkey,
    pub amount_claimed: u64,
    pub claimed_at: i64,
    pub has_claimed: bool,
    pub bump: u8,
}

impl ClaimRecord {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 1 + 1;
}

#[account]
pub struct WhitelistEntry {
    pub airdrop: Pubkey,
    pub user: Pubkey,
    pub is_eligible: bool,
    pub added_at: i64,
    pub bump: u8,
}

impl WhitelistEntry {
    pub const LEN: usize = 32 + 32 + 1 + 8 + 1;
}

// Events

#[event]
pub struct AirdropInitialized {
    pub airdrop: Pubkey,
    pub authority: Pubkey,
    pub total_supply: u64,
    pub tokens_per_claim: u64,
}

#[event]
pub struct TokensClaimed {
    pub user: Pubkey,
    pub airdrop: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct AirdropPaused {
    pub airdrop: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct AirdropResumed {
    pub airdrop: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct WhitelistAdded {
    pub airdrop: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct WhitelistRemoved {
    pub airdrop: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct ConfigUpdated {
    pub airdrop: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct EmergencyWithdrawal {
    pub airdrop: Pubkey,
    pub authority: Pubkey,
    pub amount: u64,
}

// Error Codes

#[error_code]
pub enum AirdropError {
    #[msg("Invalid supply amount")]
    InvalidSupply,

    #[msg("Invalid claim amount")]
    InvalidClaimAmount,

    #[msg("Invalid time window")]
    InvalidTimeWindow,

    #[msg("Airdrop is paused")]
    AirdropPaused,

    #[msg("Airdrop has not started yet")]
    AirdropNotStarted,

    #[msg("Airdrop has ended")]
    AirdropEnded,

    #[msg("Supply exhausted")]
    SupplyExhausted,

    #[msg("Already claimed")]
    AlreadyClaimed,

    #[msg("Not whitelisted")]
    NotWhitelisted,

    #[msg("Already paused")]
    AlreadyPaused,

    #[msg("Not paused")]
    NotPaused,
}
