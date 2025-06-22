"""
Data output utility for connectors.
Saves extracted data to JSON files that can be picked up by other services.
"""

import json
import os
import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class DataOutput:
    """Helper class to output extracted data"""
    
    def __init__(self, output_dir: str = "data_output"):
        self.output_dir = output_dir
        # Create output directory if it doesn't exist
        os.makedirs(self.output_dir, exist_ok=True)
    
    def save_data(self, connector_name: str, table_name: str, data: List[Dict[str, Any]], 
                  company_id: int) -> str:
        """
        Save data to JSON file
        
        Returns:
            Path to the saved file
        """
        if not data:
            logger.info("No data to save")
            return ""
        
        # Create filename with timestamp
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{connector_name}_{table_name}_{company_id}_{timestamp}.json"
        filepath = os.path.join(self.output_dir, filename)
        
        # Prepare output data with metadata
        output_data = {
            "metadata": {
                "connector_name": connector_name,
                "table_name": table_name,
                "company_id": company_id,
                "extracted_at": datetime.utcnow().isoformat(),
                "record_count": len(data),
                "destination_table": f"{connector_name.upper()}_{table_name.upper()}"
            },
            "data": data
        }
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, default=str)
            
            logger.info(f"Saved {len(data)} records to {filepath}")
            return filepath
            
        except Exception as e:
            logger.error(f"Failed to save data to {filepath}: {e}")
            return ""
    
    def list_data_files(self) -> List[str]:
        """List all data files in output directory"""
        try:
            files = [f for f in os.listdir(self.output_dir) if f.endswith('.json')]
            return sorted(files)
        except Exception as e:
            logger.error(f"Failed to list data files: {e}")
            return []
    
    def load_data_file(self, filename: str) -> Dict[str, Any]:
        """Load data from a specific file"""
        filepath = os.path.join(self.output_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load data file {filepath}: {e}")
            return {}
    
    def cleanup_old_files(self, days_old: int = 7):
        """Remove files older than specified days"""
        try:
            import time
            cutoff_time = time.time() - (days_old * 24 * 60 * 60)
            
            for filename in os.listdir(self.output_dir):
                filepath = os.path.join(self.output_dir, filename)
                if os.path.isfile(filepath) and os.path.getmtime(filepath) < cutoff_time:
                    os.remove(filepath)
                    logger.info(f"Removed old file: {filename}")
                    
        except Exception as e:
            logger.error(f"Failed to cleanup old files: {e}")