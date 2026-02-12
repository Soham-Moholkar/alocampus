import logging
import algokit_utils

logger = logging.getLogger(__name__)

def deploy() -> None:
    # This import will work after the build step generates the artifacts
    from smart_contracts.artifacts.credential_mint.credential_mint_client import CredentialMintFactory

    algorand = algokit_utils.AlgorandClient.from_environment()
    deployer_ = algorand.account.from_environment("DEPLOYER")

    factory = algorand.client.get_typed_app_factory(
        CredentialMintFactory, default_sender=deployer_.address
    )

    app_client, result = factory.deploy(
        on_update=algokit_utils.OnUpdate.AppendApp,
        on_schema_break=algokit_utils.OnSchemaBreak.AppendApp,
    )

    if result.operation_performed in [
        algokit_utils.OperationPerformed.Create,
        algokit_utils.OperationPerformed.Replace,
    ]:
        logger.info(
            f"Deployed CredentialMint app {app_client.app_id} to address {app_client.app_address}"
        )
