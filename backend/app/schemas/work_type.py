from pydantic import BaseModel, ConfigDict, Field


class WorkTypeBase(BaseModel):
    name: str
    departmentId: int = Field(alias="department_id")
    requiresTrafficBlock: bool = Field(default=False, alias="requires_traffic_block")
    requiresPowerBlock: bool = Field(default=False, alias="requires_power_block")
    requiresOheIsolation: bool = Field(default=False, alias="requires_ohe_isolation")
    requiresSignalDisconnection: bool = Field(default=False, alias="requires_signal_disconnection")
    
    model_config = ConfigDict(populate_by_name=True)


class WorkTypeResponse(WorkTypeBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
