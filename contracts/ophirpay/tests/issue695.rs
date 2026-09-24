#![cfg(test)]

use ophirpay_contract::{OphirPayContract, OphirPayContractClient, PaymentError};
use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};

#[test]
fn test_batch_math_overflow() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(OphirPayContract, ());
    let client = OphirPayContractClient::new(&env, &contract_id);
    
    let owner = Address::generate(&env);
    client.init(&owner);

    let mut payees = Vec::new(&env);
    let mut amounts = Vec::new(&env);
    
    for _ in 0..100 {
        payees.push_back(Address::generate(&env));
        amounts.push_back(i128::MAX / 2);
    }
    
    let asset = Address::generate(&env);
    let tx_hash = String::from_str(&env, "0xhash");
    
    // `BatchCreateResult` does not derive `Debug` (it is only ever encoded as
    // XDR), so `unwrap_err()` and `assert_eq!` — both of which require
    // `Debug` for the `Ok` type — cannot be used here. Match on the variant
    // instead.
    let res = client.try_create_batch(&owner, &payees, &amounts, &asset, &tx_hash);
    assert!(matches!(res, Err(Ok(PaymentError::MathOverflow))));
}
