#[allow(duplicate_alias, lint(self_transfer))]
module microloan::microloan {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{sender, epoch, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::transfer::public_transfer;

    // === Constants ===
    /// Initial reputation score for new users.
    const INITIAL_REPUTATION: u64 = 100;
    /// Basis points for interest calculations (100 = 1%).
    const BASIS_POINTS: u64 = 10_000;

    // === Error Codes ===
    const EALREADY_BACKED: u64 = 1;
    const EINSUFFICIENT_AMOUNT: u64 = 2;
    const ELOAN_OVERDUE: u64 = 3;
    const EINSUFFICIENT_PAYMENT: u64 = 4;
    const EINVALID_REQUESTER: u64 = 5;
    const EZERO_AMOUNT: u64 = 6;

    // === Structs ===

    /// Stores a user’s reputation score, used to track creditworthiness.
    public struct Reputation has key, store {
        id: UID,
        score: u64,
    }

    /// Represents a loan request with details about amount, interest, and status.
    public struct LoanRequest has key, store {
        id: UID,
        requester: address,
        amount: u64,
        interest_bps: u64,
        due_epoch: u64,
        backed: bool,
        backer: address,
        escrow_id: ID, // Reference to the Escrow object holding coins
    }

    /// Holds coins in escrow until loan repayment or other resolution.
    public struct Escrow has key, store {
        id: UID,
        coins: Balance<SUI>, // Use Balance for efficiency
    }

    // === Public Functions ===

    /// Returns the reputation score of a user.
    public fun score(rep: &Reputation): u64 {
        rep.score
    }

    /// Returns the ID of the escrow associated with a loan request.
    public fun get_escrow_id(loan: &LoanRequest): ID {
        loan.escrow_id
    }

    /// Returns the amount of a loan request.
    public fun amount(loan: &LoanRequest): u64 {
        loan.amount
    }

    /// Returns the interest rate (in basis points) of a loan request.
    public fun interest_bps(loan: &LoanRequest): u64 {
        loan.interest_bps
    }

    /// Returns the due epoch of a loan request.
    public fun due_epoch(loan: &LoanRequest): u64 {
        loan.due_epoch
    }

    /// Returns whether a loan request is backed.
    public fun backed(loan: &LoanRequest): bool {
        loan.backed
    }

    /// Returns the backer address of a loan request.
    public fun backer(loan: &LoanRequest): address {
        loan.backer
    }

    /// Initializes a new Reputation resource for the sender with an initial score.
    public fun init_reputation(ctx: &mut TxContext) {
        let rep = Reputation {
            id: object::new(ctx),
            score: INITIAL_REPUTATION,
        };
        public_transfer(rep, sender(ctx));
    }

    /// Creates a new loan request, locking coins in an escrow.
    /// - `coins`: The amount to borrow.
    /// - `interest_bps`: Interest rate in basis points (e.g., 100 = 1%).
    /// - `due_epoch`: Epoch by which the loan must be repaid.
    public fun create_loan(
        coins: Coin<SUI>,
        interest_bps: u64,
        due_epoch: u64,
        ctx: &mut TxContext
    ) {
        let amt = coin::value(&coins);
        assert!(amt > 0, EZERO_AMOUNT);
        let requester = sender(ctx);

        // Convert Coin to Balance and create escrow
        let escrow = Escrow {
            id: object::new(ctx),
            coins: coin::into_balance(coins),
        };
        let escrow_id = object::id(&escrow);

        let loan = LoanRequest {
            id: object::new(ctx),
            requester,
            amount: amt,
            interest_bps,
            due_epoch,
            backed: false,
            backer: @0x0,
            escrow_id,
        };

        public_transfer(escrow, requester);
        public_transfer(loan, requester);
    }

    /// Backs a loan by providing the exact amount, transferring funds to escrow.
    /// - `coins`: Coins matching the loan amount.
    /// - `loan`: The loan request to back.
    public fun back_loan(
        coins: Coin<SUI>,
        loan: &mut LoanRequest,
        ctx: &mut TxContext
    ) {
        assert!(!loan.backed, EALREADY_BACKED);
        let amt = coin::value(&coins);
        assert!(amt == loan.amount, EINSUFFICIENT_AMOUNT);

        // Convert Coin to Balance and create new escrow
        let escrow = Escrow {
            id: object::new(ctx),
            coins: coin::into_balance(coins),
        };
        loan.backed = true;
        loan.backer = sender(ctx);
        loan.escrow_id = object::id(&escrow);

        public_transfer(escrow, loan.requester);
    }

    /// Repays a loan before the due epoch, increasing the requester’s reputation.
    /// - `coins`: Payment including principal and interest.
    /// - `loan`: The loan to repay.
    /// - `rep`: The requester’s reputation to update.
    public fun repay(
        mut coins: Coin<SUI>,
        loan: &LoanRequest,
        rep: &mut Reputation,
        ctx: &mut TxContext
    ) {
        let now = epoch(ctx);
        assert!(now <= loan.due_epoch, ELOAN_OVERDUE);
        assert!(sender(ctx) == loan.requester, EINVALID_REQUESTER);

        let total_due = calculate_total_due(loan.amount, loan.interest_bps);
        let paid = coin::value(&coins);
        assert!(paid >= total_due, EINSUFFICIENT_PAYMENT);

        // Split coins for repayment
        let repayment = coin::split(&mut coins, total_due, ctx);
        // Send repayment to backer
        public_transfer(repayment, loan.backer);

        // Return any change to the requester
        get_change(coins, ctx);

        // Increase reputation
        rep.score = rep.score + 10;
    }

    /// Destroys an Escrow object, returning its coins to the specified recipient.
    public fun destroy_escrow(escrow: Escrow, ctx: &mut TxContext): Coin<SUI> {
        let Escrow { id, coins } = escrow;
        object::delete(id);
        coin::from_balance(coins, ctx)
    }

    // === Test-Only Functions ===

    /// Burns an Escrow’s coins for testing, regardless of value.
    #[test_only]
    public fun burn_escrow_for_testing(escrow: Escrow, ctx: &mut TxContext) {
        let coins = destroy_escrow(escrow, ctx);
        let balance = coin::into_balance(coins);
        balance::destroy_for_testing(balance);
    }

    // === Helper Functions ===

    /// Calculates the total amount due (principal + interest).
    fun calculate_total_due(amount: u64, interest_bps: u64): u64 {
        amount + (amount * interest_bps) / BASIS_POINTS
    }

    /// Returns any excess coins to the sender or destroys zero-value coins.
    fun get_change(coins: Coin<SUI>, ctx: &TxContext) {
        if (coin::value(&coins) > 0) {
            public_transfer(coins, sender(ctx));
        } else {
            coin::destroy_zero(coins);
        }
    }
}