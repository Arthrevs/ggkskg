from pydantic import BaseModel, ConfigDict, Field


class WorkCompatibilityRuleBase(BaseModel):
    workTypeAId: int = Field(alias="work_type_a_id")
    workTypeBId: int = Field(alias="work_type_b_id")
    isCompatible: bool = Field(alias="is_compatible")
    
    model_config = ConfigDict(populate_by_name=True)


class WorkCompatibilityRuleResponse(WorkCompatibilityRuleBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
