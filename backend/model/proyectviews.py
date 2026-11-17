from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from database.database import Base 
from sqlalchemy.orm import relationship
from datetime import datetime

class ProjectViews(Base):
    __tablename__ = "project_views"

    project_views_pk = Column(Integer, primary_key=True, index=True)
    is_active = Column(Boolean, default=True)

    #Foreign Keys
    project_fk = Column(Integer, ForeignKey("project.project_pk"))
    view_fk = Column(Integer, ForeignKey("views.views_pk"))
    
    # Relationships
    project = relationship("Project", back_populates="project_views")
    view = relationship("Views", back_populates="project_views")