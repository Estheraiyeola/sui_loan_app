#[test_only, allow(unused_use, duplicate_alias, unused_let_mut)]
module microloan::microloan_tests {
    use sui::test_scenario;
    use microloan::microloan::{Self, Reputation, LoanRequest, Escrow};
    use sui::coin;
    use sui::sui::SUI;
    use sui::object;

    #[test]
    fun test_repay_loan() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;

        // Initialize reputation
        {
            let ctx = test_scenario::ctx(scenario);
            microloan::init_reputation(ctx);
        };

        // Create a loan request
        let initial_escrow_id;
        test_scenario::next_tx(scenario, @0xA);
        {
            let ctx = test_scenario::ctx(scenario);
            let coins = coin::mint_for_testing<SUI>(1000, ctx);
            microloan::create_loan(coins, 100, 10, ctx);
        };

        // Verify loan request and get initial escrow_id
        test_scenario::next_tx(scenario, @0xA);
        {
            let loan = test_scenario::take_from_address<LoanRequest>(scenario, @0xA);
            assert!(microloan::amount(&loan) == 1000, 1);
            assert!(microloan::interest_bps(&loan) == 100, 2);
            assert!(microloan::due_epoch(&loan) == 10, 3);
            assert!(!microloan::backed(&loan), 4);
            assert!(microloan::backer(&loan) == @0x0, 5);
            initial_escrow_id = microloan::get_escrow_id(&loan);
            test_scenario::return_to_address(@0xA, loan);
        };

        // Clean up initial escrow (from create_loan)
        test_scenario::next_tx(scenario, @0xA);
        {
            let escrow = test_scenario::take_from_address<Escrow>(scenario, @0xA);
            assert!(object::id(&escrow) == initial_escrow_id, 6);
            let ctx = test_scenario::ctx(scenario);
            microloan::burn_escrow_for_testing(escrow, ctx);
        };

        // Back the loan
        let final_escrow_id;
        test_scenario::next_tx(scenario, @0xB);
        {
            let mut loan = test_scenario::take_from_address<LoanRequest>(scenario, @0xA);
            let ctx = test_scenario::ctx(scenario);
            let coins = coin::mint_for_testing<SUI>(1000, ctx);
            microloan::back_loan(coins, &mut loan, ctx);
            assert!(microloan::backed(&loan), 8);
            assert!(microloan::backer(&loan) == @0xB, 9);
            final_escrow_id = microloan::get_escrow_id(&loan);
            test_scenario::return_to_address(@0xA, loan);
        };

        // Repay the loan
        test_scenario::next_tx(scenario, @0xA);
        {
            let loan = test_scenario::take_from_address<LoanRequest>(scenario, @0xA);
            let mut rep = test_scenario::take_from_address<Reputation>(scenario, @0xA);
            let ctx = test_scenario::ctx(scenario);
            let coins = coin::mint_for_testing<SUI>(1100, ctx); // 1000 + 10% interest
            microloan::repay(coins, &loan, &mut rep, ctx);
            assert!(microloan::score(&rep) == 110, 10); // Check reputation increased
            test_scenario::return_to_address(@0xA, loan);
            test_scenario::return_to_address(@0xA, rep);
        };

        // Clean up final escrow (from back_loan)
        test_scenario::next_tx(scenario, @0xA);
        {
            let escrow = test_scenario::take_from_address<Escrow>(scenario, @0xA);
            assert!(object::id(&escrow) == final_escrow_id, 11);
            let ctx = test_scenario::ctx(scenario);
            microloan::burn_escrow_for_testing(escrow, ctx);
        };

        test_scenario::end(scenario_val);
    }
}