module deceit::gold{

use sui::coin::{Self, TreasuryCap};

public struct GOLD has drop {}

fun init(witness: GOLD, ctx: &mut TxContext) {
    let (treasury, metadata) = coin::create_currency(
        witness,
        6, // decimals
        b"GOLD", // name
        b"GD", // symbol
        b"Gold winnings from game Deceit", // description
        option::none(), // icon_url
        ctx,
    );
    transfer::public_freeze_object(metadata);
    transfer::public_transfer(treasury, ctx.sender());
}

entry fun change_admin(
    new_admin: address,
    treasury_cap: TreasuryCap<GOLD>
){
    transfer::public_transfer(treasury_cap, new_admin);
}

public fun mint(
    treasury_cap: &mut TreasuryCap<GOLD>,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    let coin = coin::mint(treasury_cap, amount, ctx);
    transfer::public_transfer(coin, recipient);
}

}