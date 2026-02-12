from algopy import *
from algopy.arc4 import abimethod

class CredentialMint(ARC4Contract):
    """
    Smart Contract for minting academic credentials as Algorand Standard Assets (ASAs).
    """
    
    def __init__(self) -> None:
        pass

    @abimethod
    def mint_credential(
        self,
        student_address: Account,
        course_name: String,
        grade_hash: String,
        metadata_url: String # IPFS CID
    ) -> UInt64:
        """
        Mints a credential ASA and transfers it to the student.
        """
        
        # 1. Create the ASA
        # In a real scenario, we might want to ensure the contract is the creator/manager
        # Here we use inner transactions to mint
        
        itxn.AssetConfig(
            total=1,
            decimals=0,
            default_frozen=False,
            unit_name="CRED",
            asset_name=course_name,
            url=metadata_url,
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            freeze=Global.current_application_address,
            clawback=Global.current_application_address
        ).submit()
        
        created_asset = itxn.created_asset_id
        
        # 2. Transfer to student
        # The contract needs to hold the asset first (it does by default as creator)
        # Then transfer to student. Student must opt-in to the asset first in a real scenario
        # or we use an Atomic Transfer where student opts-in in the same group.
        # For simplicity here, we assume student will opt-in or we just mint to contract for now.
        
        # To transfer, we need to ensure the contract has min balance (it should be covered by MBR)
        
        itxn.AssetTransfer(
            xfer_asset=created_asset,
            asset_receiver=student_address,
            asset_amount=1
        ).submit()
        
        return created_asset.id
