from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from database.database import Base 
from sqlalchemy.orm import relationship
from datetime import datetime

class ProjectUsers(Base):
    __tablename__ = "project_users"

    project_users_pk = Column(Integer, primary_key=True, index=True)
    is_active = Column(Boolean, default=True)
    
    #Foreign Keys
    project_fk = Column(Integer, ForeignKey("project.project_pk"))
    user_fk = Column(Integer, ForeignKey("user.user_pk"))
    
    # Relationships
    project = relationship("Project", back_populates="project_users")
    user = relationship("User", back_populates="project_users")