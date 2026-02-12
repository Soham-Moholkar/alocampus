from algopy import *
from algopy.arc4 import abimethod

class TrustRegistry(ARC4Contract):
    """
    Smart Contract for storing issuer trust scores.
    """
    
    def __init__(self) -> None:
        self.issuer_scores = BoxMap(Account, UInt64, key_prefix="")
        self.oracle_address = Account(Global.creator_address) # Default to creator

    @abimethod
    def set_oracle(self, oracle: Account) -> None:
        """Sets the address authorized to update scores"""
        assert Txn.sender == Global.creator_address, "Only creator can set oracle"
        self.oracle_address = oracle

    @abimethod
    def update_trust_score(self, issuer: Account, score: UInt64) -> None:
        """Updates the trust score for an issuer"""
        # In a real app, we check if Txn.sender is an authorized oracle
        # For hackathon, we can allow the creator or a specific oracle address
        assert Txn.sender == self.oracle_address or Txn.sender == Global.creator_address, "Unauthorized"
        
        self.issuer_scores[issuer] = score

    @abimethod(readonly=True)
    def get_trust_score(self, issuer: Account) -> UInt64:
        """Returns the trust score for an issuer. Defaults to 0 if not found."""
        score, exists = self.issuer_scores.maybe(issuer)
        if exists:
            return score
        return UInt64(0)
