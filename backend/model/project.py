from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Date
from database.database import Base 
from sqlalchemy.orm import relationship
from datetime import datetime

class Project(Base):
    __tablename__ = "project"
    
    project_pk = Column(Integer, primary_key=True, index=True)
    project_name = Column(String)
    project_description = Column(String)
    start_date = Column(Date, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    
    # Relationships
    project_views = relationship("ProjectViews", back_populates="project")
    project_users = relationship("ProjectUsers", back_populates="project")