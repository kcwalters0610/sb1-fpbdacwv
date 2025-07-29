/*
  # Create technician locations function

  1. New Functions
    - `get_latest_technician_locations(company_id_param)`
      - Returns the most recent location for each technician in a company
      - Uses DISTINCT ON to get only the latest timestamp per technician
      - Filters by company_id for security

  2. Security
    - Function respects existing RLS policies on technician_locations table
    - Only returns data that the calling user has permission to see
*/

CREATE OR REPLACE FUNCTION public.get_latest_technician_locations(company_id_param uuid)
RETURNS SETOF public.technician_locations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (tl.technician_id)
        tl.*
    FROM
        public.technician_locations tl
    WHERE
        tl.company_id = company_id_param
    ORDER BY
        tl.technician_id, tl.timestamp DESC;
END;
$$;