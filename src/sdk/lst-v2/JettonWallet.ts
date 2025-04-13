import { Address, beginCell, Cell, ContractProvider, Sender } from '@ton/core';
import { JettonWallet as BasicJettonWallet } from './jetton-dao/JettonWallet';


export class JettonWallet extends BasicJettonWallet {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {
        super(address, init);
    }
    static createFromAddress(address: Address) {
        return new JettonWallet(address);
    }
    async sendBurnWithParams(provider: ContractProvider, via: Sender, value: bigint,
                          jetton_amount: bigint,
                          responseAddress:Address,
                          waitTillRoundEnd:boolean, // opposite of request_immediate_withdrawal
                          fillOrKill:boolean) {
        const customPayload = beginCell()
           .storeUint(Number(waitTillRoundEnd), 1)
           .storeUint(Number(fillOrKill), 1).endCell();
        return this.sendBurn(provider, via, value, jetton_amount, responseAddress,
                             customPayload);

    }
}
