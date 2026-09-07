from pydantic import BaseModel
from typing import Optional
import datetime as dt

class UserBase(BaseModel):
    username: str
    role: str
    department_id: Optional[int] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: dt.datetime

    model_config = {"from_attributes": True}
