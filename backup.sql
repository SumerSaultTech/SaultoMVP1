--
-- PostgreSQL database dump
--

\restrict rX1X78r29PMZ0iIEZnJP05uhIyO2rW4Y71AxryzIvHh92rv5GmviiyxV4I3BccQ

-- Dumped from database version 14.19 (Homebrew)
-- Dumped by pg_dump version 14.19 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: analytics_company_1001; Type: SCHEMA; Schema: -; Owner: miapatrikios
--

CREATE SCHEMA analytics_company_1001;


ALTER SCHEMA analytics_company_1001 OWNER TO miapatrikios;

--
-- Name: analytics_company_1002; Type: SCHEMA; Schema: -; Owner: miapatrikios
--

CREATE SCHEMA analytics_company_1002;


ALTER SCHEMA analytics_company_1002 OWNER TO miapatrikios;

--
-- Name: analytics_company_1003; Type: SCHEMA; Schema: -; Owner: miapatrikios
--

CREATE SCHEMA analytics_company_1003;


ALTER SCHEMA analytics_company_1003 OWNER TO miapatrikios;

--
-- Name: analytics_company_1748544793859; Type: SCHEMA; Schema: -; Owner: miapatrikios
--

CREATE SCHEMA analytics_company_1748544793859;


ALTER SCHEMA analytics_company_1748544793859 OWNER TO miapatrikios;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: hubspot_company; Type: TABLE; Schema: analytics_company_1001; Owner: miapatrikios
--

CREATE TABLE analytics_company_1001.hubspot_company (
    id text NOT NULL,
    name text,
    domain text,
    industry text,
    employees integer,
    annual_revenue numeric,
    city text,
    state text,
    country text,
    lifecycle_stage text,
    lead_status text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    last_activity_date date,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'hubspot'::text,
    company_id bigint DEFAULT 1001
);


ALTER TABLE analytics_company_1001.hubspot_company OWNER TO miapatrikios;

--
-- Name: hubspot_contact; Type: TABLE; Schema: analytics_company_1001; Owner: miapatrikios
--

CREATE TABLE analytics_company_1001.hubspot_contact (
    id text NOT NULL,
    firstname text,
    lastname text,
    email text,
    phone text,
    jobtitle text,
    company text,
    industry text,
    lifecycle_stage text,
    lead_status text,
    original_source text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    last_activity_date date,
    email_opens integer,
    email_clicks integer,
    form_submissions integer,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'hubspot'::text,
    company_id bigint DEFAULT 1001
);


ALTER TABLE analytics_company_1001.hubspot_contact OWNER TO miapatrikios;

--
-- Name: hubspot_deal; Type: TABLE; Schema: analytics_company_1001; Owner: miapatrikios
--

CREATE TABLE analytics_company_1001.hubspot_deal (
    id text NOT NULL,
    dealname text,
    amount numeric,
    dealstage text,
    closedate date,
    probability numeric,
    pipeline text,
    dealtype text,
    leadsource text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'hubspot'::text,
    company_id bigint DEFAULT 1001
);


ALTER TABLE analytics_company_1001.hubspot_deal OWNER TO miapatrikios;

--
-- Name: quickbooks_customer; Type: TABLE; Schema: analytics_company_1001; Owner: miapatrikios
--

CREATE TABLE analytics_company_1001.quickbooks_customer (
    id text NOT NULL,
    customer_name text,
    company_name text,
    email text,
    phone text,
    billing_address text,
    city text,
    state text,
    country text,
    customer_type text,
    payment_terms text,
    credit_limit numeric,
    current_balance numeric,
    total_revenue numeric,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    last_transaction_date date,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'quickbooks'::text,
    company_id bigint DEFAULT 1001
);


ALTER TABLE analytics_company_1001.quickbooks_customer OWNER TO miapatrikios;

--
-- Name: quickbooks_expense; Type: TABLE; Schema: analytics_company_1001; Owner: miapatrikios
--

CREATE TABLE analytics_company_1001.quickbooks_expense (
    id text NOT NULL,
    expense_number text,
    vendor_name text,
    account_name text,
    category text,
    amount numeric,
    expense_date date,
    payment_method text,
    memo text,
    billable boolean,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'quickbooks'::text,
    company_id bigint DEFAULT 1001
);


ALTER TABLE analytics_company_1001.quickbooks_expense OWNER TO miapatrikios;

--
-- Name: quickbooks_invoice; Type: TABLE; Schema: analytics_company_1001; Owner: miapatrikios
--

CREATE TABLE analytics_company_1001.quickbooks_invoice (
    id text NOT NULL,
    invoice_number text,
    customer_id text,
    customer_name text,
    total numeric,
    subtotal numeric,
    tax_amount numeric,
    status text,
    due_date date,
    invoice_date date,
    paid_date date,
    terms text,
    memo text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'quickbooks'::text,
    company_id bigint DEFAULT 1001
);


ALTER TABLE analytics_company_1001.quickbooks_invoice OWNER TO miapatrikios;

--
-- Name: salesforce_contact; Type: TABLE; Schema: analytics_company_1001; Owner: miapatrikios
--

CREATE TABLE analytics_company_1001.salesforce_contact (
    id text NOT NULL,
    firstname text,
    lastname text,
    email text,
    phone text,
    title text,
    accountid text,
    department text,
    leadsource text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    last_activity_date date,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'salesforce'::text,
    company_id bigint DEFAULT 1001
);


ALTER TABLE analytics_company_1001.salesforce_contact OWNER TO miapatrikios;

--
-- Name: salesforce_lead; Type: TABLE; Schema: analytics_company_1001; Owner: miapatrikios
--

CREATE TABLE analytics_company_1001.salesforce_lead (
    id text NOT NULL,
    firstname text,
    lastname text,
    email text,
    phone text,
    title text,
    company text,
    industry text,
    status text,
    rating text,
    leadsource text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    converted_date timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'salesforce'::text,
    company_id bigint DEFAULT 1001
);


ALTER TABLE analytics_company_1001.salesforce_lead OWNER TO miapatrikios;

--
-- Name: salesforce_opportunity; Type: TABLE; Schema: analytics_company_1001; Owner: miapatrikios
--

CREATE TABLE analytics_company_1001.salesforce_opportunity (
    id text NOT NULL,
    name text,
    amount numeric,
    stagename text,
    closedate date,
    probability numeric,
    accountid text,
    ownerid text,
    type text,
    leadsource text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'salesforce'::text,
    company_id bigint DEFAULT 1001
);


ALTER TABLE analytics_company_1001.salesforce_opportunity OWNER TO miapatrikios;

--
-- Name: jira_issue; Type: TABLE; Schema: analytics_company_1002; Owner: miapatrikios
--

CREATE TABLE analytics_company_1002.jira_issue (
    id text NOT NULL,
    key text,
    project_id text,
    summary text,
    description text,
    issue_type text,
    status text,
    priority text,
    assignee text,
    reporter text,
    created_date timestamp without time zone,
    updated_date timestamp without time zone,
    resolved_date timestamp without time zone,
    story_points integer,
    sprint text,
    labels text[],
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'jira'::text,
    company_id bigint DEFAULT 1002
);


ALTER TABLE analytics_company_1002.jira_issue OWNER TO miapatrikios;

--
-- Name: jira_project; Type: TABLE; Schema: analytics_company_1002; Owner: miapatrikios
--

CREATE TABLE analytics_company_1002.jira_project (
    id text NOT NULL,
    key text,
    name text,
    description text,
    lead text,
    project_type text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'jira'::text,
    company_id bigint DEFAULT 1002
);


ALTER TABLE analytics_company_1002.jira_project OWNER TO miapatrikios;

--
-- Name: jira_user; Type: TABLE; Schema: analytics_company_1002; Owner: miapatrikios
--

CREATE TABLE analytics_company_1002.jira_user (
    id text NOT NULL,
    username text,
    email text,
    display_name text,
    active boolean,
    account_type text,
    created_date timestamp without time zone,
    last_login_date timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'jira'::text,
    company_id bigint DEFAULT 1002
);


ALTER TABLE analytics_company_1002.jira_user OWNER TO miapatrikios;

--
-- Name: salesforce_contact; Type: TABLE; Schema: analytics_company_1002; Owner: miapatrikios
--

CREATE TABLE analytics_company_1002.salesforce_contact (
    id text NOT NULL,
    firstname text,
    lastname text,
    email text,
    phone text,
    title text,
    accountid text,
    department text,
    leadsource text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    last_activity_date date,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'salesforce'::text,
    company_id bigint DEFAULT 1002
);


ALTER TABLE analytics_company_1002.salesforce_contact OWNER TO miapatrikios;

--
-- Name: salesforce_lead; Type: TABLE; Schema: analytics_company_1002; Owner: miapatrikios
--

CREATE TABLE analytics_company_1002.salesforce_lead (
    id text NOT NULL,
    firstname text,
    lastname text,
    email text,
    phone text,
    title text,
    company text,
    industry text,
    status text,
    rating text,
    leadsource text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    converted_date timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'salesforce'::text,
    company_id bigint DEFAULT 1002
);


ALTER TABLE analytics_company_1002.salesforce_lead OWNER TO miapatrikios;

--
-- Name: salesforce_opportunity; Type: TABLE; Schema: analytics_company_1002; Owner: miapatrikios
--

CREATE TABLE analytics_company_1002.salesforce_opportunity (
    id text NOT NULL,
    name text,
    amount numeric,
    stagename text,
    closedate date,
    probability numeric,
    accountid text,
    ownerid text,
    type text,
    leadsource text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'salesforce'::text,
    company_id bigint DEFAULT 1002
);


ALTER TABLE analytics_company_1002.salesforce_opportunity OWNER TO miapatrikios;

--
-- Name: hubspot_company; Type: TABLE; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

CREATE TABLE analytics_company_1748544793859.hubspot_company (
    id text NOT NULL,
    name text,
    domain text,
    industry text,
    employees integer,
    annual_revenue numeric,
    city text,
    state text,
    country text,
    lifecycle_stage text,
    lead_status text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    last_activity_date date,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'hubspot'::text,
    company_id bigint DEFAULT '1748544793859'::bigint
);


ALTER TABLE analytics_company_1748544793859.hubspot_company OWNER TO miapatrikios;

--
-- Name: hubspot_contact; Type: TABLE; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

CREATE TABLE analytics_company_1748544793859.hubspot_contact (
    id text NOT NULL,
    firstname text,
    lastname text,
    email text,
    phone text,
    jobtitle text,
    company text,
    industry text,
    lifecycle_stage text,
    lead_status text,
    original_source text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    last_activity_date date,
    email_opens integer,
    email_clicks integer,
    form_submissions integer,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'hubspot'::text,
    company_id bigint DEFAULT '1748544793859'::bigint
);


ALTER TABLE analytics_company_1748544793859.hubspot_contact OWNER TO miapatrikios;

--
-- Name: hubspot_deal; Type: TABLE; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

CREATE TABLE analytics_company_1748544793859.hubspot_deal (
    id text NOT NULL,
    dealname text,
    amount numeric,
    dealstage text,
    closedate date,
    probability numeric,
    pipeline text,
    dealtype text,
    leadsource text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'hubspot'::text,
    company_id bigint DEFAULT '1748544793859'::bigint
);


ALTER TABLE analytics_company_1748544793859.hubspot_deal OWNER TO miapatrikios;

--
-- Name: jira_issue_types; Type: TABLE; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

CREATE TABLE analytics_company_1748544793859.jira_issue_types (
    avatarid text,
    description text,
    hierarchylevel text,
    iconurl text,
    id text,
    name text,
    scope text,
    self text,
    subtask text,
    untranslatedname text,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system character varying(100),
    company_id bigint
);


ALTER TABLE analytics_company_1748544793859.jira_issue_types OWNER TO miapatrikios;

--
-- Name: jira_priorities; Type: TABLE; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

CREATE TABLE analytics_company_1748544793859.jira_priorities (
    description text,
    iconurl text,
    id text,
    name text,
    self text,
    statuscolor text,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system character varying(100),
    company_id bigint
);


ALTER TABLE analytics_company_1748544793859.jira_priorities OWNER TO miapatrikios;

--
-- Name: jira_projects; Type: TABLE; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

CREATE TABLE analytics_company_1748544793859.jira_projects (
    avatarurls text,
    description text,
    entityid text,
    expand text,
    id text,
    isprivate text,
    issuetypes text,
    issuetypes_count text,
    key text,
    lead text,
    lead_display_name text,
    name text,
    projectkeys text,
    projectkeys_count text,
    projecttypekey text,
    properties text,
    self text,
    simplified text,
    style text,
    uuid text,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system character varying(100),
    company_id bigint
);


ALTER TABLE analytics_company_1748544793859.jira_projects OWNER TO miapatrikios;

--
-- Name: jira_statuses; Type: TABLE; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

CREATE TABLE analytics_company_1748544793859.jira_statuses (
    description text,
    iconurl text,
    id text,
    name text,
    scope text,
    self text,
    statuscategory text,
    untranslatedname text,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system character varying(100),
    company_id bigint
);


ALTER TABLE analytics_company_1748544793859.jira_statuses OWNER TO miapatrikios;

--
-- Name: jira_users; Type: TABLE; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

CREATE TABLE analytics_company_1748544793859.jira_users (
    accountid text,
    accounttype text,
    active text,
    avatarurls text,
    displayname text,
    emailaddress text,
    locale text,
    self text,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system character varying(100),
    company_id bigint
);


ALTER TABLE analytics_company_1748544793859.jira_users OWNER TO miapatrikios;

--
-- Name: salesforce_contact; Type: TABLE; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

CREATE TABLE analytics_company_1748544793859.salesforce_contact (
    id text NOT NULL,
    firstname text,
    lastname text,
    email text,
    phone text,
    title text,
    accountid text,
    department text,
    leadsource text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    last_activity_date date,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'salesforce'::text,
    company_id bigint DEFAULT '1748544793859'::bigint
);


ALTER TABLE analytics_company_1748544793859.salesforce_contact OWNER TO miapatrikios;

--
-- Name: salesforce_lead; Type: TABLE; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

CREATE TABLE analytics_company_1748544793859.salesforce_lead (
    id text NOT NULL,
    firstname text,
    lastname text,
    email text,
    phone text,
    title text,
    company text,
    industry text,
    status text,
    rating text,
    leadsource text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    converted_date timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'salesforce'::text,
    company_id bigint DEFAULT '1748544793859'::bigint
);


ALTER TABLE analytics_company_1748544793859.salesforce_lead OWNER TO miapatrikios;

--
-- Name: salesforce_opportunity; Type: TABLE; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

CREATE TABLE analytics_company_1748544793859.salesforce_opportunity (
    id text NOT NULL,
    name text,
    amount numeric,
    stagename text,
    closedate date,
    probability numeric,
    accountid text,
    ownerid text,
    type text,
    leadsource text,
    created_date timestamp without time zone,
    last_modified_date timestamp without time zone,
    loaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source_system text DEFAULT 'salesforce'::text,
    company_id bigint DEFAULT '1748544793859'::bigint
);


ALTER TABLE analytics_company_1748544793859.salesforce_opportunity OWNER TO miapatrikios;

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: miapatrikios
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now(),
    metadata jsonb
);


ALTER TABLE public.chat_messages OWNER TO miapatrikios;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: miapatrikios
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.chat_messages_id_seq OWNER TO miapatrikios;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: miapatrikios
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: miapatrikios
--

CREATE TABLE public.companies (
    id bigint NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


ALTER TABLE public.companies OWNER TO miapatrikios;

--
-- Name: data_sources; Type: TABLE; Schema: public; Owner: miapatrikios
--

CREATE TABLE public.data_sources (
    id integer NOT NULL,
    company_id bigint NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'disconnected'::text NOT NULL,
    connector_id text,
    table_count integer DEFAULT 0,
    last_sync_at timestamp without time zone,
    config jsonb,
    credentials jsonb,
    sync_tables text[] DEFAULT '{}'::text[],
    sync_frequency text DEFAULT 'daily'::text,
    last_sync_records integer DEFAULT 0,
    last_sync_error text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.data_sources OWNER TO miapatrikios;

--
-- Name: data_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: miapatrikios
--

CREATE SEQUENCE public.data_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.data_sources_id_seq OWNER TO miapatrikios;

--
-- Name: data_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: miapatrikios
--

ALTER SEQUENCE public.data_sources_id_seq OWNED BY public.data_sources.id;


--
-- Name: kpi_metrics; Type: TABLE; Schema: public; Owner: miapatrikios
--

CREATE TABLE public.kpi_metrics (
    id integer NOT NULL,
    company_id bigint NOT NULL,
    name text NOT NULL,
    description text,
    value text,
    change_percent text,
    sql_query text,
    yearly_goal text,
    current_progress text,
    goal_progress text,
    goal_type text DEFAULT 'yearly'::text,
    quarterly_goals jsonb,
    monthly_goals jsonb,
    category text DEFAULT 'revenue'::text NOT NULL,
    priority integer DEFAULT 1,
    format text DEFAULT 'currency'::text,
    is_increasing boolean DEFAULT true,
    is_north_star boolean DEFAULT false,
    last_calculated_at timestamp without time zone
);


ALTER TABLE public.kpi_metrics OWNER TO miapatrikios;

--
-- Name: kpi_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: miapatrikios
--

CREATE SEQUENCE public.kpi_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.kpi_metrics_id_seq OWNER TO miapatrikios;

--
-- Name: kpi_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: miapatrikios
--

ALTER SEQUENCE public.kpi_metrics_id_seq OWNED BY public.kpi_metrics.id;


--
-- Name: metric_history; Type: TABLE; Schema: public; Owner: miapatrikios
--

CREATE TABLE public.metric_history (
    id integer NOT NULL,
    metric_id integer,
    value text NOT NULL,
    recorded_at timestamp without time zone DEFAULT now(),
    period text NOT NULL
);


ALTER TABLE public.metric_history OWNER TO miapatrikios;

--
-- Name: metric_history_id_seq; Type: SEQUENCE; Schema: public; Owner: miapatrikios
--

CREATE SEQUENCE public.metric_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.metric_history_id_seq OWNER TO miapatrikios;

--
-- Name: metric_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: miapatrikios
--

ALTER SEQUENCE public.metric_history_id_seq OWNED BY public.metric_history.id;


--
-- Name: pipeline_activities; Type: TABLE; Schema: public; Owner: miapatrikios
--

CREATE TABLE public.pipeline_activities (
    id integer NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    status text NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now(),
    metadata jsonb
);


ALTER TABLE public.pipeline_activities OWNER TO miapatrikios;

--
-- Name: pipeline_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: miapatrikios
--

CREATE SEQUENCE public.pipeline_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.pipeline_activities_id_seq OWNER TO miapatrikios;

--
-- Name: pipeline_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: miapatrikios
--

ALTER SEQUENCE public.pipeline_activities_id_seq OWNED BY public.pipeline_activities.id;


--
-- Name: setup_status; Type: TABLE; Schema: public; Owner: miapatrikios
--

CREATE TABLE public.setup_status (
    id integer NOT NULL,
    warehouse_connected boolean DEFAULT false,
    data_sources_configured boolean DEFAULT false,
    models_deployed integer DEFAULT 0,
    total_models integer DEFAULT 0,
    last_updated timestamp without time zone DEFAULT now()
);


ALTER TABLE public.setup_status OWNER TO miapatrikios;

--
-- Name: setup_status_id_seq; Type: SEQUENCE; Schema: public; Owner: miapatrikios
--

CREATE SEQUENCE public.setup_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.setup_status_id_seq OWNER TO miapatrikios;

--
-- Name: setup_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: miapatrikios
--

ALTER SEQUENCE public.setup_status_id_seq OWNED BY public.setup_status.id;


--
-- Name: sql_models; Type: TABLE; Schema: public; Owner: miapatrikios
--

CREATE TABLE public.sql_models (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name text NOT NULL,
    layer text NOT NULL,
    sql_content text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    deployed_at timestamp without time zone,
    dependencies text[] DEFAULT '{}'::text[]
);


ALTER TABLE public.sql_models OWNER TO miapatrikios;

--
-- Name: sql_models_id_seq; Type: SEQUENCE; Schema: public; Owner: miapatrikios
--

CREATE SEQUENCE public.sql_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sql_models_id_seq OWNER TO miapatrikios;

--
-- Name: sql_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: miapatrikios
--

ALTER SEQUENCE public.sql_models_id_seq OWNED BY public.sql_models.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: miapatrikios
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    company_id integer,
    role text DEFAULT 'user'::text
);


ALTER TABLE public.users OWNER TO miapatrikios;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: miapatrikios
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO miapatrikios;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: miapatrikios
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: data_sources id; Type: DEFAULT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.data_sources ALTER COLUMN id SET DEFAULT nextval('public.data_sources_id_seq'::regclass);


--
-- Name: kpi_metrics id; Type: DEFAULT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.kpi_metrics ALTER COLUMN id SET DEFAULT nextval('public.kpi_metrics_id_seq'::regclass);


--
-- Name: metric_history id; Type: DEFAULT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.metric_history ALTER COLUMN id SET DEFAULT nextval('public.metric_history_id_seq'::regclass);


--
-- Name: pipeline_activities id; Type: DEFAULT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.pipeline_activities ALTER COLUMN id SET DEFAULT nextval('public.pipeline_activities_id_seq'::regclass);


--
-- Name: setup_status id; Type: DEFAULT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.setup_status ALTER COLUMN id SET DEFAULT nextval('public.setup_status_id_seq'::regclass);


--
-- Name: sql_models id; Type: DEFAULT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.sql_models ALTER COLUMN id SET DEFAULT nextval('public.sql_models_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: hubspot_company; Type: TABLE DATA; Schema: analytics_company_1001; Owner: miapatrikios
--

COPY analytics_company_1001.hubspot_company (id, name, domain, industry, employees, annual_revenue, city, state, country, lifecycle_stage, lead_status, created_date, last_modified_date, last_activity_date, loaded_at, source_system, company_id) FROM stdin;
HCOTC001	SaaS Migration Co	saas-migration.com	Technology	150	15000000	San Francisco	CA	USA	customer	closed	2024-09-20 00:00:00	2025-08-15 00:00:00	2025-08-12	2025-08-18 13:27:34.355321	hubspot	1001
HCOTC002	Email Campaign Org	email-campaign.org	Marketing	75	8000000	Austin	TX	USA	customer	closed	2024-11-15 00:00:00	2025-08-14 00:00:00	2025-08-10	2025-08-18 13:27:34.355321	hubspot	1001
HCOTC003	Content Opportunity Co	content-opportunity.co	Technology	200	25000000	Seattle	WA	USA	salesqualifiedlead	new	2025-05-10 00:00:00	2025-08-17 00:00:00	2025-08-15	2025-08-18 13:27:34.355321	hubspot	1001
HCOTC004	Social Media Gen	social-media-gen.com	Media	45	5000000	Los Angeles	CA	USA	salesqualifiedlead	inprogress	2025-05-25 00:00:00	2025-08-18 00:00:00	2025-08-16	2025-08-18 13:27:34.355321	hubspot	1001
HCOTC005	SEO Organic Net	seo-organic.net	Marketing	30	3000000	Denver	CO	USA	marketingqualifiedlead	new	2025-06-15 00:00:00	2025-08-16 00:00:00	2025-08-14	2025-08-18 13:27:34.355321	hubspot	1001
\.


--
-- Data for Name: hubspot_contact; Type: TABLE DATA; Schema: analytics_company_1001; Owner: miapatrikios
--

COPY analytics_company_1001.hubspot_contact (id, firstname, lastname, email, phone, jobtitle, company, industry, lifecycle_stage, lead_status, original_source, created_date, last_modified_date, last_activity_date, email_opens, email_clicks, form_submissions, loaded_at, source_system, company_id) FROM stdin;
HCTC001	Alex	Thompson	athompson@saas-migration.com	555-0301	Technical Lead	SaaS Migration Co	Technology	customer	closed	Content Marketing	2024-09-20 00:00:00	2025-08-15 00:00:00	2025-08-12	45	12	8	2025-08-18 13:27:34.353395	hubspot	1001
HCTC002	Maria	Garcia	mgarcia@email-campaign.org	555-0302	Marketing Director	Email Campaign Org	Marketing	customer	closed	Email Marketing	2024-11-15 00:00:00	2025-08-14 00:00:00	2025-08-10	67	18	5	2025-08-18 13:27:34.353395	hubspot	1001
HCTC003	Kevin	Lee	klee@webinar-leads.com	555-0303	Head of Growth	Webinar Leads Inc	Education	customer	closed	Webinar	2024-12-01 00:00:00	2025-08-16 00:00:00	2025-08-13	34	9	12	2025-08-18 13:27:34.353395	hubspot	1001
HCTC004	Sophie	Miller	smiller@content-opportunity.co	555-0304	VP Marketing	Content Opportunity Co	Technology	salesqualifiedlead	new	Blog/Content	2025-05-10 00:00:00	2025-08-17 00:00:00	2025-08-15	28	7	4	2025-08-18 13:27:34.353395	hubspot	1001
HCTC005	Daniel	Young	dyoung@social-media-gen.com	555-0305	Social Media Manager	Social Media Gen	Media	salesqualifiedlead	inprogress	Social Media	2025-05-25 00:00:00	2025-08-18 00:00:00	2025-08-16	19	5	6	2025-08-18 13:27:34.353395	hubspot	1001
HCTC006	Isabella	Lopez	ilopez@seo-organic.net	555-0306	SEO Specialist	SEO Organic Net	Marketing	marketingqualifiedlead	new	Organic Search	2025-06-15 00:00:00	2025-08-16 00:00:00	2025-08-14	15	4	3	2025-08-18 13:27:34.353395	hubspot	1001
HCTC007	Ryan	Hall	rhall@ppc-campaign.io	555-0307	Digital Marketing Lead	PPC Campaign IO	Advertising	marketingqualifiedlead	qualified	Paid Search	2025-06-28 00:00:00	2025-08-17 00:00:00	2025-08-15	22	6	2	2025-08-18 13:27:34.353395	hubspot	1001
HCTC008	Grace	Wright	gwright@newsletter-sub.com	555-0308	Content Manager	Newsletter Sub Com	Publishing	lead	new	Email Marketing	2025-07-25 00:00:00	2025-08-15 00:00:00	2025-08-13	8	2	1	2025-08-18 13:27:34.353395	hubspot	1001
HCTC009	Nathan	Green	ngreen@event-attendee.org	555-0309	Event Coordinator	Event Attendee Org	Events	lead	new	Event	2025-08-02 00:00:00	2025-08-16 00:00:00	2025-08-14	12	3	2	2025-08-18 13:27:34.353395	hubspot	1001
\.


--
-- Data for Name: hubspot_deal; Type: TABLE DATA; Schema: analytics_company_1001; Owner: miapatrikios
--

COPY analytics_company_1001.hubspot_deal (id, dealname, amount, dealstage, closedate, probability, pipeline, dealtype, leadsource, created_date, last_modified_date, loaded_at, source_system, company_id) FROM stdin;
HSTC001	Inbound SaaS Migration	67000	closedwon	2024-12-08	100	sales	newbusiness	Content Marketing	2024-10-15 00:00:00	2024-12-08 00:00:00	2025-08-18 13:27:34.350429	hubspot	1001
HSTC002	Email Campaign Conversion	34000	closedwon	2025-01-22	100	sales	newbusiness	Email Marketing	2024-11-30 00:00:00	2025-01-22 00:00:00	2025-08-18 13:27:34.350429	hubspot	1001
HSTC003	Webinar Lead Conversion	89000	closedwon	2025-02-14	100	sales	newbusiness	Webinar	2024-12-10 00:00:00	2025-02-14 00:00:00	2025-08-18 13:27:34.350429	hubspot	1001
HSTC004	Content Lead Opportunity	112000	qualified	2025-10-20	65	sales	newbusiness	Blog/Content	2025-05-15 00:00:00	2025-08-16 00:00:00	2025-08-18 13:27:34.350429	hubspot	1001
HSTC005	Social Media Generated	78000	presentation	2025-09-25	45	sales	newbusiness	Social Media	2025-06-01 00:00:00	2025-08-14 00:00:00	2025-08-18 13:27:34.350429	hubspot	1001
HSTC006	SEO Organic Lead	95000	qualified	2025-11-10	55	sales	newbusiness	Organic Search	2025-06-20 00:00:00	2025-08-17 00:00:00	2025-08-18 13:27:34.350429	hubspot	1001
HSTC007	PPC Campaign Lead	134000	negotiation	2025-09-15	70	sales	newbusiness	Paid Search	2025-07-01 00:00:00	2025-08-18 00:00:00	2025-08-18 13:27:34.350429	hubspot	1001
HSTC008	Newsletter Subscriber	23000	marketingqualified	2025-12-01	20	marketing	newbusiness	Email Marketing	2025-08-01 00:00:00	2025-08-16 00:00:00	2025-08-18 13:27:34.350429	hubspot	1001
HSTC009	Event Attendee Lead	45000	marketingqualified	2025-11-30	25	marketing	newbusiness	Event	2025-08-05 00:00:00	2025-08-17 00:00:00	2025-08-18 13:27:34.350429	hubspot	1001
\.


--
-- Data for Name: quickbooks_customer; Type: TABLE DATA; Schema: analytics_company_1001; Owner: miapatrikios
--

COPY analytics_company_1001.quickbooks_customer (id, customer_name, company_name, email, phone, billing_address, city, state, country, customer_type, payment_terms, credit_limit, current_balance, total_revenue, created_date, last_modified_date, last_transaction_date, loaded_at, source_system, company_id) FROM stdin;
CUST001	Enterprise Corp	Enterprise Corp	billing@enterprise-corp.com	555-1001	123 Business Ave	New York	NY	USA	Enterprise	Net 30	500000	0	125000	2024-09-01 00:00:00	2024-12-28 00:00:00	2024-12-28	2025-08-18 13:27:34.36319	quickbooks	1001
CUST002	DataFlow Systems	DataFlow Systems	accounts@dataflow-systems.com	555-1002	456 Tech Street	Boston	MA	USA	Enterprise	Net 30	300000	0	95000	2024-08-15 00:00:00	2024-12-15 00:00:00	2024-12-15	2025-08-18 13:27:34.36319	quickbooks	1001
CUST003	CloudSync Solutions	CloudSync Solutions	finance@cloudsync.io	555-1003	789 Cloud Way	San Francisco	CA	USA	Enterprise	Net 30	200000	0	78000	2024-10-01 00:00:00	2024-12-20 00:00:00	2024-12-20	2025-08-18 13:27:34.36319	quickbooks	1001
CUST004	Analytics Plus Inc	Analytics Plus Inc	billing@analytics-plus.com	555-1004	321 Data Drive	Chicago	IL	USA	Enterprise	Net 30	400000	0	156000	2024-09-20 00:00:00	2025-01-05 00:00:00	2025-01-05	2025-08-18 13:27:34.36319	quickbooks	1001
CUST005	SmartData Corp	SmartData Corp	ap@smartdata.co	555-1005	654 Smart Boulevard	Austin	TX	USA	Mid-Market	Net 30	150000	0	88000	2024-11-05 00:00:00	2025-01-28 00:00:00	2025-01-28	2025-08-18 13:27:34.36319	quickbooks	1001
CUST006	Process Auto LLC	Process Auto LLC	payments@processauto.com	555-1006	987 Automation Lane	Denver	CO	USA	Mid-Market	Net 30	200000	0	112000	2024-11-20 00:00:00	2025-02-22 00:00:00	2025-02-22	2025-08-18 13:27:34.36319	quickbooks	1001
CUST007	Premium Support Co	Premium Support Co	billing@premium-support.net	555-1007	147 Support Street	Portland	OR	USA	Small Business	Net 30	100000	0	45000	2024-12-15 00:00:00	2025-03-25 00:00:00	2025-03-25	2025-08-18 13:27:34.36319	quickbooks	1001
CUST008	SaaS Migration Co	SaaS Migration Co	finance@saas-migration.com	555-1008	258 Migration Road	Seattle	WA	USA	Mid-Market	Net 30	150000	0	67000	2024-09-10 00:00:00	2024-12-20 00:00:00	2024-12-20	2025-08-18 13:27:34.36319	quickbooks	1001
CUST009	Email Campaign Org	Email Campaign Org	accounting@email-campaign.org	555-1009	369 Campaign Circle	Austin	TX	USA	Small Business	Net 30	75000	0	34000	2024-11-10 00:00:00	2025-02-05 00:00:00	2025-02-05	2025-08-18 13:27:34.36319	quickbooks	1001
CUST010	Webinar Leads Inc	Webinar Leads Inc	finance@webinar-leads.com	555-1010	741 Webinar Way	Los Angeles	CA	USA	Mid-Market	Net 30	120000	0	89000	2024-12-01 00:00:00	2025-02-28 00:00:00	2025-02-28	2025-08-18 13:27:34.36319	quickbooks	1001
CUST011	Manufacturing Co	Manufacturing Co	ap@manufacturing-co.com	555-1011	852 Industrial Blvd	Detroit	MI	USA	Enterprise	Net 30	250000	98000	98000	2025-07-01 00:00:00	2025-08-15 00:00:00	2025-08-15	2025-08-18 13:27:34.36319	quickbooks	1001
CUST012	RetailChain LLC	RetailChain LLC	billing@retailchain.com	555-1012	963 Retail Plaza	Miami	FL	USA	Enterprise	Net 30	300000	145000	145000	2025-07-15 00:00:00	2025-08-18 00:00:00	2025-08-18	2025-08-18 13:27:34.36319	quickbooks	1001
\.


--
-- Data for Name: quickbooks_expense; Type: TABLE DATA; Schema: analytics_company_1001; Owner: miapatrikios
--

COPY analytics_company_1001.quickbooks_expense (id, expense_number, vendor_name, account_name, category, amount, expense_date, payment_method, memo, billable, created_date, last_modified_date, loaded_at, source_system, company_id) FROM stdin;
QETC001	EXP-2025-001	Office Lease Co	Rent Expense	Facilities	15000	2025-01-01	Bank Transfer	Monthly office rent - January	f	2025-01-01 00:00:00	2025-01-01 00:00:00	2025-08-18 13:27:34.361221	quickbooks	1001
QETC002	EXP-2025-002	Office Lease Co	Rent Expense	Facilities	15000	2025-02-01	Bank Transfer	Monthly office rent - February	f	2025-02-01 00:00:00	2025-02-01 00:00:00	2025-08-18 13:27:34.361221	quickbooks	1001
QETC003	EXP-2025-003	Office Lease Co	Rent Expense	Facilities	15000	2025-03-01	Bank Transfer	Monthly office rent - March	f	2025-03-01 00:00:00	2025-03-01 00:00:00	2025-08-18 13:27:34.361221	quickbooks	1001
QETC004	EXP-2025-004	AWS Cloud Services	Technology	Infrastructure	8500	2025-01-15	Credit Card	Cloud hosting - Q1	f	2025-01-15 00:00:00	2025-01-15 00:00:00	2025-08-18 13:27:34.361221	quickbooks	1001
QETC005	EXP-2025-005	Salesforce Inc	Technology	Software	12000	2025-02-01	Bank Transfer	CRM licenses - Annual	f	2025-02-01 00:00:00	2025-02-01 00:00:00	2025-08-18 13:27:34.361221	quickbooks	1001
QETC006	EXP-2025-006	HubSpot Inc	Technology	Software	8000	2025-02-15	Credit Card	Marketing automation - Annual	f	2025-02-15 00:00:00	2025-02-15 00:00:00	2025-08-18 13:27:34.361221	quickbooks	1001
QETC007	EXP-2025-007	Google Ads	Marketing	Advertising	5000	2025-01-31	Credit Card	PPC campaigns - January	f	2025-01-31 00:00:00	2025-01-31 00:00:00	2025-08-18 13:27:34.361221	quickbooks	1001
QETC008	EXP-2025-008	Trade Show Events	Marketing	Events	18000	2025-03-15	Bank Transfer	Industry conference - Q1	f	2025-03-15 00:00:00	2025-03-15 00:00:00	2025-08-18 13:27:34.361221	quickbooks	1001
QETC009	EXP-2025-009	Content Agency	Marketing	Content	6000	2025-02-28	Credit Card	Content creation - February	f	2025-02-28 00:00:00	2025-02-28 00:00:00	2025-08-18 13:27:34.361221	quickbooks	1001
QETC010	EXP-2025-010	Payroll Services Inc	Payroll	Salaries	75000	2025-01-31	Bank Transfer	Employee salaries - January	f	2025-01-31 00:00:00	2025-01-31 00:00:00	2025-08-18 13:27:34.361221	quickbooks	1001
QETC011	EXP-2025-011	Benefits Provider	Payroll	Benefits	12000	2025-02-01	Bank Transfer	Health insurance - February	f	2025-02-01 00:00:00	2025-02-01 00:00:00	2025-08-18 13:27:34.361221	quickbooks	1001
\.


--
-- Data for Name: quickbooks_invoice; Type: TABLE DATA; Schema: analytics_company_1001; Owner: miapatrikios
--

COPY analytics_company_1001.quickbooks_invoice (id, invoice_number, customer_id, customer_name, total, subtotal, tax_amount, status, due_date, invoice_date, paid_date, terms, memo, created_date, last_modified_date, loaded_at, source_system, company_id) FROM stdin;
QITC001	INV-2024-001	CUST001	Enterprise Corp	125000	119048	5952	paid	2025-01-15	2024-12-15	2024-12-28	Net 30	TechCorp Enterprise License - Annual	2024-12-15 00:00:00	2024-12-28 00:00:00	2025-08-18 13:27:34.359746	quickbooks	1001
QITC002	INV-2024-002	CUST002	DataFlow Systems	95000	90476	4524	paid	2024-12-28	2024-11-28	2024-12-15	Net 30	DataFlow Implementation - Project	2024-11-28 00:00:00	2024-12-15 00:00:00	2025-08-18 13:27:34.359746	quickbooks	1001
QITC003	INV-2024-003	CUST003	CloudSync Solutions	78000	74286	3714	paid	2025-01-10	2024-12-10	2024-12-20	Net 30	CloudSync Renewal - Annual License	2024-12-10 00:00:00	2024-12-20 00:00:00	2025-08-18 13:27:34.359746	quickbooks	1001
QITC004	INV-2024-004	CUST004	Analytics Plus Inc	156000	148571	7429	paid	2025-01-20	2024-12-20	2025-01-05	Net 30	Analytics Plus Package - Enterprise	2024-12-20 00:00:00	2025-01-05 00:00:00	2025-08-18 13:27:34.359746	quickbooks	1001
QITC005	INV-2025-001	CUST005	SmartData Corp	88000	83810	4190	paid	2025-02-15	2025-01-15	2025-01-28	Net 30	SmartData Integration - Implementation	2025-01-15 00:00:00	2025-01-28 00:00:00	2025-08-18 13:27:34.359746	quickbooks	1001
QITC006	INV-2025-002	CUST006	Process Auto LLC	112000	106667	5333	paid	2025-03-08	2025-02-08	2025-02-22	Net 30	Process Automation Suite - Annual	2025-02-08 00:00:00	2025-02-22 00:00:00	2025-08-18 13:27:34.359746	quickbooks	1001
QITC007	INV-2025-003	CUST007	Premium Support Co	45000	42857	2143	paid	2025-04-12	2025-03-12	2025-03-25	Net 30	Premium Support Upgrade - Annual	2025-03-12 00:00:00	2025-03-25 00:00:00	2025-08-18 13:27:34.359746	quickbooks	1001
QITC008	INV-2024-005	CUST008	SaaS Migration Co	67000	63810	3190	paid	2025-01-08	2024-12-08	2024-12-20	Net 30	Inbound SaaS Migration - Project	2024-12-08 00:00:00	2024-12-20 00:00:00	2025-08-18 13:27:34.359746	quickbooks	1001
QITC009	INV-2025-004	CUST009	Email Campaign Org	34000	32381	1619	paid	2025-02-22	2025-01-22	2025-02-05	Net 30	Email Campaign Conversion - License	2025-01-22 00:00:00	2025-02-05 00:00:00	2025-08-18 13:27:34.359746	quickbooks	1001
QITC010	INV-2025-005	CUST010	Webinar Leads Inc	89000	84762	4238	paid	2025-03-14	2025-02-14	2025-02-28	Net 30	Webinar Lead Conversion - Enterprise	2025-02-14 00:00:00	2025-02-28 00:00:00	2025-08-18 13:27:34.359746	quickbooks	1001
QITC011	INV-2025-006	CUST011	Manufacturing Co	98000	93333	4667	open	2025-09-15	2025-08-15	\N	Net 30	Manufacturing Integration - Phase 1	2025-08-15 00:00:00	2025-08-15 00:00:00	2025-08-18 13:27:34.359746	quickbooks	1001
QITC012	INV-2025-007	CUST012	RetailChain LLC	145000	138095	6905	open	2025-09-18	2025-08-18	\N	Net 30	Retail Analytics Platform - Annual	2025-08-18 00:00:00	2025-08-18 00:00:00	2025-08-18 13:27:34.359746	quickbooks	1001
\.


--
-- Data for Name: salesforce_contact; Type: TABLE DATA; Schema: analytics_company_1001; Owner: miapatrikios
--

COPY analytics_company_1001.salesforce_contact (id, firstname, lastname, email, phone, title, accountid, department, leadsource, created_date, last_modified_date, last_activity_date, loaded_at, source_system, company_id) FROM stdin;
003TC001	Sarah	Johnson	sarah.johnson@enterprise-corp.com	555-0101	CTO	ACC001	Technology	Website	2024-09-15 00:00:00	2025-08-14 00:00:00	2025-08-10	2025-08-18 13:27:34.343571	salesforce	1001
003TC002	Michael	Chen	mchen@dataflow-systems.com	555-0102	VP Engineering	ACC002	Engineering	Referral	2024-08-20 00:00:00	2025-08-12 00:00:00	2025-08-08	2025-08-18 13:27:34.343571	salesforce	1001
003TC003	Lisa	Rodriguez	lrodriguez@cloudsync.io	555-0103	Head of Operations	ACC003	Operations	Existing Customer	2024-10-05 00:00:00	2025-08-15 00:00:00	2025-08-12	2025-08-18 13:27:34.343571	salesforce	1001
003TC004	David	Park	dpark@analytics-plus.com	555-0104	Chief Data Officer	ACC004	Data	Inbound	2024-09-28 00:00:00	2025-08-13 00:00:00	2025-08-11	2025-08-18 13:27:34.343571	salesforce	1001
003TC005	Jennifer	Williams	jwilliams@smartdata.co	555-0105	Director of IT	ACC005	IT	Trade Show	2024-11-10 00:00:00	2025-08-16 00:00:00	2025-08-14	2025-08-18 13:27:34.343571	salesforce	1001
003TC006	Robert	Taylor	rtaylor@processauto.com	555-0106	Operations Manager	ACC006	Operations	Cold Call	2024-11-25 00:00:00	2025-08-17 00:00:00	2025-08-15	2025-08-18 13:27:34.343571	salesforce	1001
003TC007	Amanda	Brown	abrown@premium-support.net	555-0107	Customer Success Manager	ACC007	Customer Success	Customer Success	2025-01-02 00:00:00	2025-08-18 00:00:00	2025-08-16	2025-08-18 13:27:34.343571	salesforce	1001
003TC008	James	Wilson	jwilson@global-enterprise.com	555-0108	SVP Technology	ACC008	Technology	Partner Referral	2025-01-10 00:00:00	2025-08-18 00:00:00	2025-08-17	2025-08-18 13:27:34.343571	salesforce	1001
\.


--
-- Data for Name: salesforce_lead; Type: TABLE DATA; Schema: analytics_company_1001; Owner: miapatrikios
--

COPY analytics_company_1001.salesforce_lead (id, firstname, lastname, email, phone, title, company, industry, status, rating, leadsource, created_date, last_modified_date, converted_date, loaded_at, source_system, company_id) FROM stdin;
00QTC001	Mark	Anderson	manderson@techstartup.io	555-0201	Founder	TechStartup Inc	Technology	Qualified	Hot	Website	2025-08-01 00:00:00	2025-08-15 00:00:00	\N	2025-08-18 13:27:34.347137	salesforce	1001
00QTC002	Emily	Davis	edavis@manufacturing-co.com	555-0202	IT Director	Manufacturing Co	Manufacturing	Working	Warm	Trade Show	2025-08-05 00:00:00	2025-08-16 00:00:00	\N	2025-08-18 13:27:34.347137	salesforce	1001
00QTC003	Carlos	Martinez	cmartinez@retailchain.com	555-0203	Head of Analytics	RetailChain LLC	Retail	Qualified	Hot	Referral	2025-08-08 00:00:00	2025-08-17 00:00:00	\N	2025-08-18 13:27:34.347137	salesforce	1001
00QTC004	Rachel	Kim	rkim@healthtech.org	555-0204	CIO	HealthTech Solutions	Healthcare	Nurturing	Warm	Social Media	2025-08-10 00:00:00	2025-08-18 00:00:00	\N	2025-08-18 13:27:34.347137	salesforce	1001
00QTC005	Thomas	White	twhite@financial-services.com	555-0205	VP Technology	Financial Services Corp	Financial Services	Working	Hot	Cold Call	2025-08-12 00:00:00	2025-08-18 00:00:00	\N	2025-08-18 13:27:34.347137	salesforce	1001
\.


--
-- Data for Name: salesforce_opportunity; Type: TABLE DATA; Schema: analytics_company_1001; Owner: miapatrikios
--

COPY analytics_company_1001.salesforce_opportunity (id, name, amount, stagename, closedate, probability, accountid, ownerid, type, leadsource, created_date, last_modified_date, loaded_at, source_system, company_id) FROM stdin;
006TC001	TechCorp Enterprise License	125000	Closed Won	2024-12-15	100	ACC001	USR001	New Business	Website	2024-10-01 00:00:00	2024-12-15 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC002	DataFlow Implementation	95000	Closed Won	2024-11-28	100	ACC002	USR002	New Business	Referral	2024-09-15 00:00:00	2024-11-28 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC003	CloudSync Renewal	78000	Closed Won	2024-12-10	100	ACC003	USR001	Renewal	Existing Customer	2024-11-01 00:00:00	2024-12-10 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC004	Analytics Plus Package	156000	Closed Won	2024-12-20	100	ACC004	USR003	Upsell	Inbound	2024-10-15 00:00:00	2024-12-20 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC005	SmartData Integration	88000	Closed Won	2025-01-15	100	ACC005	USR002	New Business	Trade Show	2024-11-20 00:00:00	2025-01-15 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC006	Process Automation Suite	112000	Closed Won	2025-02-08	100	ACC006	USR001	New Business	Cold Call	2024-12-01 00:00:00	2025-02-08 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC007	Premium Support Upgrade	45000	Closed Won	2025-03-12	100	ACC007	USR003	Upsell	Customer Success	2025-01-10 00:00:00	2025-03-12 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC008	Global Enterprise Deal	285000	Negotiation/Review	2025-09-30	75	ACC008	USR001	New Business	Partner Referral	2025-01-15 00:00:00	2025-08-15 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC009	Multi-Region Deployment	198000	Proposal/Price Quote	2025-10-15	60	ACC009	USR002	New Business	Website	2025-02-01 00:00:00	2025-08-10 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC010	Advanced Analytics Add-on	67000	Value Proposition	2025-11-01	40	ACC010	USR003	Upsell	Inbound	2025-03-01 00:00:00	2025-08-12 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC011	Startup Growth Package	43000	Qualification	2025-12-15	25	ACC011	USR002	New Business	Social Media	2025-04-01 00:00:00	2025-08-14 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC012	Insurance Compliance Module	89000	Needs Analysis	2025-10-30	35	ACC012	USR001	New Business	Trade Show	2025-03-15 00:00:00	2025-08-16 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC013	Manufacturing ERP Integration	134000	Closed Lost	2024-11-30	0	ACC013	USR003	New Business	Website	2024-08-01 00:00:00	2024-11-30 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
006TC014	Retail Analytics Platform	76000	Closed Lost	2024-12-05	0	ACC014	USR002	New Business	Cold Call	2024-09-10 00:00:00	2024-12-05 00:00:00	2025-08-18 13:27:34.338417	salesforce	1001
\.


--
-- Data for Name: jira_issue; Type: TABLE DATA; Schema: analytics_company_1002; Owner: miapatrikios
--

COPY analytics_company_1002.jira_issue (id, key, project_id, summary, description, issue_type, status, priority, assignee, reporter, created_date, updated_date, resolved_date, story_points, sprint, labels, loaded_at, source_system, company_id) FROM stdin;
1001	CORE-1	10001	User Authentication System	Implement OAuth 2.0 login system	Story	Done	High	alex.dev@startupco.com	product@startupco.com	2025-07-01 00:00:00	2025-07-15 00:00:00	2025-07-15 00:00:00	8	Sprint 15	{authentication,security}	2025-08-18 13:27:41.20175	jira	1002
1002	CORE-2	10001	Dashboard UI Components	Create reusable dashboard components	Story	Done	Medium	jenny.frontend@startupco.com	design@startupco.com	2025-07-01 00:00:00	2025-07-12 00:00:00	2025-07-12 00:00:00	5	Sprint 15	{frontend,ui}	2025-08-18 13:27:41.20175	jira	1002
1003	CORE-3	10001	Database Optimization	Optimize query performance for user data	Story	Done	High	mike.backend@startupco.com	alex.dev@startupco.com	2025-07-08 00:00:00	2025-07-20 00:00:00	2025-07-20 00:00:00	13	Sprint 15	{backend,performance}	2025-08-18 13:27:41.20175	jira	1002
1004	MOBILE-1	10002	iOS App Store Submission	Prepare and submit iOS app to App Store	Task	Done	Critical	sarah.mobile@startupco.com	product@startupco.com	2025-07-15 00:00:00	2025-07-25 00:00:00	2025-07-25 00:00:00	3	Sprint 16	{mobile,ios,release}	2025-08-18 13:27:41.20175	jira	1002
1005	API-1	10003	Rate Limiting Implementation	Add rate limiting to API endpoints	Story	Done	Medium	mike.backend@startupco.com	alex.dev@startupco.com	2025-07-10 00:00:00	2025-07-18 00:00:00	2025-07-18 00:00:00	5	Sprint 15	{api,security}	2025-08-18 13:27:41.20175	jira	1002
1006	CORE-4	10001	Real-time Notifications	Implement WebSocket-based notifications	Story	In Progress	High	alex.dev@startupco.com	product@startupco.com	2025-08-01 00:00:00	2025-08-18 00:00:00	\N	8	Sprint 17	{realtime,websockets}	2025-08-18 13:27:41.20175	jira	1002
1007	CORE-5	10001	User Settings Page	Build comprehensive user settings interface	Story	In Progress	Medium	jenny.frontend@startupco.com	design@startupco.com	2025-08-05 00:00:00	2025-08-17 00:00:00	\N	5	Sprint 17	{frontend,settings}	2025-08-18 13:27:41.20175	jira	1002
1008	MOBILE-2	10002	Push Notifications	Implement push notifications for mobile	Story	In Progress	High	sarah.mobile@startupco.com	product@startupco.com	2025-08-08 00:00:00	2025-08-18 00:00:00	\N	8	Sprint 17	{mobile,notifications}	2025-08-18 13:27:41.20175	jira	1002
1009	API-2	10003	Webhook System	Build webhook delivery system	Story	Code Review	Medium	mike.backend@startupco.com	alex.dev@startupco.com	2025-08-10 00:00:00	2025-08-16 00:00:00	\N	13	Sprint 17	{api,webhooks}	2025-08-18 13:27:41.20175	jira	1002
1010	CORE-6	10001	Advanced Analytics Dashboard	Create analytics and reporting dashboard	Epic	To Do	Low	unassigned	product@startupco.com	2025-08-15 00:00:00	2025-08-15 00:00:00	\N	21	Backlog	{analytics,dashboard}	2025-08-18 13:27:41.20175	jira	1002
1011	MOBILE-3	10002	Offline Mode Support	Add offline functionality to mobile app	Story	To Do	Medium	unassigned	product@startupco.com	2025-08-16 00:00:00	2025-08-16 00:00:00	\N	13	Backlog	{mobile,offline}	2025-08-18 13:27:41.20175	jira	1002
1012	API-3	10003	GraphQL Implementation	Migrate REST API to GraphQL	Epic	To Do	Low	unassigned	alex.dev@startupco.com	2025-08-17 00:00:00	2025-08-17 00:00:00	\N	34	Backlog	{api,graphql}	2025-08-18 13:27:41.20175	jira	1002
1013	CORE-7	10001	Login Session Timeout Bug	Users getting logged out too frequently	Bug	In Progress	Critical	alex.dev@startupco.com	support@startupco.com	2025-08-12 00:00:00	2025-08-18 00:00:00	\N	3	Sprint 17	{bug,authentication}	2025-08-18 13:27:41.20175	jira	1002
1014	MOBILE-4	10002	iOS Crash on Startup	App crashes on iPhone 12 during startup	Bug	To Do	High	sarah.mobile@startupco.com	qa@startupco.com	2025-08-14 00:00:00	2025-08-18 00:00:00	\N	5	Sprint 17	{bug,ios,crash}	2025-08-18 13:27:41.20175	jira	1002
\.


--
-- Data for Name: jira_project; Type: TABLE DATA; Schema: analytics_company_1002; Owner: miapatrikios
--

COPY analytics_company_1002.jira_project (id, key, name, description, lead, project_type, created_date, last_modified_date, loaded_at, source_system, company_id) FROM stdin;
10001	CORE	Core Platform	Main product development project	alex.dev@startupco.com	software	2024-01-15 00:00:00	2025-08-18 00:00:00	2025-08-18 13:27:41.197858	jira	1002
10002	MOBILE	Mobile App	iOS and Android mobile applications	sarah.mobile@startupco.com	software	2024-03-01 00:00:00	2025-08-17 00:00:00	2025-08-18 13:27:41.197858	jira	1002
10003	API	API Development	REST API and integrations	mike.backend@startupco.com	software	2024-02-01 00:00:00	2025-08-16 00:00:00	2025-08-18 13:27:41.197858	jira	1002
\.


--
-- Data for Name: jira_user; Type: TABLE DATA; Schema: analytics_company_1002; Owner: miapatrikios
--

COPY analytics_company_1002.jira_user (id, username, email, display_name, active, account_type, created_date, last_login_date, loaded_at, source_system, company_id) FROM stdin;
usr001	alex.dev	alex.dev@startupco.com	Alex Johnson (Lead Developer)	t	atlassian	2024-01-15 00:00:00	2025-08-18 00:00:00	2025-08-18 13:27:41.203752	jira	1002
usr002	sarah.mobile	sarah.mobile@startupco.com	Sarah Kim (Mobile Developer)	t	atlassian	2024-03-01 00:00:00	2025-08-17 00:00:00	2025-08-18 13:27:41.203752	jira	1002
usr003	mike.backend	mike.backend@startupco.com	Mike Chen (Backend Developer)	t	atlassian	2024-02-01 00:00:00	2025-08-18 00:00:00	2025-08-18 13:27:41.203752	jira	1002
usr004	jenny.frontend	jenny.frontend@startupco.com	Jenny Martinez (Frontend Developer)	t	atlassian	2024-04-15 00:00:00	2025-08-16 00:00:00	2025-08-18 13:27:41.203752	jira	1002
usr005	product	product@startupco.com	Emma Wilson (Product Manager)	t	atlassian	2024-01-15 00:00:00	2025-08-17 00:00:00	2025-08-18 13:27:41.203752	jira	1002
usr006	design	design@startupco.com	Ryan Taylor (UX Designer)	t	atlassian	2024-02-15 00:00:00	2025-08-15 00:00:00	2025-08-18 13:27:41.203752	jira	1002
usr007	qa	qa@startupco.com	Lisa Patel (QA Engineer)	t	atlassian	2024-05-01 00:00:00	2025-08-16 00:00:00	2025-08-18 13:27:41.203752	jira	1002
usr008	support	support@startupco.com	Tom Brown (Customer Support)	t	atlassian	2024-06-01 00:00:00	2025-08-14 00:00:00	2025-08-18 13:27:41.203752	jira	1002
\.


--
-- Data for Name: salesforce_contact; Type: TABLE DATA; Schema: analytics_company_1002; Owner: miapatrikios
--

COPY analytics_company_1002.salesforce_contact (id, firstname, lastname, email, phone, title, accountid, department, leadsource, created_date, last_modified_date, last_activity_date, loaded_at, source_system, company_id) FROM stdin;
003SC001	Jake	Miller	jake@early-customer.io	555-2001	Founder & CEO	ACC201	Executive	Product Hunt	2024-10-15 00:00:00	2025-08-16 00:00:00	2025-08-14	2025-08-18 13:27:41.19079	salesforce	1002
003SC002	Anna	Chen	anna@beta-customer.com	555-2002	CTO	ACC202	Engineering	Beta Program	2024-11-20 00:00:00	2025-08-15 00:00:00	2025-08-12	2025-08-18 13:27:41.19079	salesforce	1002
003SC003	Tom	Wilson	tom@startup-package.co	555-2003	Head of Product	ACC203	Product	Referral	2025-01-05 00:00:00	2025-08-17 00:00:00	2025-08-15	2025-08-18 13:27:41.19079	salesforce	1002
003SC004	Sarah	Davis	sarah@growth-plan.net	555-2004	VP Growth	ACC204	Growth	Customer Success	2025-01-25 00:00:00	2025-08-18 00:00:00	2025-08-16	2025-08-18 13:27:41.19079	salesforce	1002
003SC005	Alex	Rodriguez	alex@seriesa-startup.io	555-2005	Co-Founder	ACC205	Executive	Investor Network	2025-05-20 00:00:00	2025-08-18 00:00:00	2025-08-17	2025-08-18 13:27:41.19079	salesforce	1002
\.


--
-- Data for Name: salesforce_lead; Type: TABLE DATA; Schema: analytics_company_1002; Owner: miapatrikios
--

COPY analytics_company_1002.salesforce_lead (id, firstname, lastname, email, phone, title, company, industry, status, rating, leadsource, created_date, last_modified_date, converted_date, loaded_at, source_system, company_id) FROM stdin;
00QSC001	Emma	Taylor	emma@fintech-startup.co	555-2101	Founder	FinTech Startup	Financial Technology	Working	Hot	AngelList	2025-08-01 00:00:00	2025-08-16 00:00:00	\N	2025-08-18 13:27:41.194265	salesforce	1002
00QSC002	Ryan	Kim	ryan@healthtech-co.com	555-2102	CTO	HealthTech Co	Healthcare	Qualified	Warm	TechCrunch	2025-08-05 00:00:00	2025-08-17 00:00:00	\N	2025-08-18 13:27:41.194265	salesforce	1002
00QSC003	Maya	Patel	maya@edtech-solution.io	555-2103	CEO	EdTech Solution	Education	Nurturing	Warm	Hacker News	2025-08-08 00:00:00	2025-08-18 00:00:00	\N	2025-08-18 13:27:41.194265	salesforce	1002
00QSC004	Chris	Brown	chris@devtools-inc.com	555-2104	Founder	DevTools Inc	Developer Tools	Working	Hot	GitHub	2025-08-10 00:00:00	2025-08-18 00:00:00	\N	2025-08-18 13:27:41.194265	salesforce	1002
\.


--
-- Data for Name: salesforce_opportunity; Type: TABLE DATA; Schema: analytics_company_1002; Owner: miapatrikios
--

COPY analytics_company_1002.salesforce_opportunity (id, name, amount, stagename, closedate, probability, accountid, ownerid, type, leadsource, created_date, last_modified_date, loaded_at, source_system, company_id) FROM stdin;
006SC001	Early Customer License	15000	Closed Won	2024-12-20	100	ACC201	USR201	New Business	Product Hunt	2024-11-01 00:00:00	2024-12-20 00:00:00	2025-08-18 13:27:41.186177	salesforce	1002
006SC002	Beta Customer Conversion	8000	Closed Won	2025-01-15	100	ACC202	USR201	New Business	Beta Program	2024-12-01 00:00:00	2025-01-15 00:00:00	2025-08-18 13:27:41.186177	salesforce	1002
006SC003	Startup Package Deal	12000	Closed Won	2025-02-28	100	ACC203	USR202	New Business	Referral	2025-01-10 00:00:00	2025-02-28 00:00:00	2025-08-18 13:27:41.186177	salesforce	1002
006SC004	Growth Plan Upgrade	25000	Closed Won	2025-03-15	100	ACC204	USR201	Upsell	Customer Success	2025-02-01 00:00:00	2025-03-15 00:00:00	2025-08-18 13:27:41.186177	salesforce	1002
006SC005	Series A Funded Startup	45000	Negotiation/Review	2025-09-30	80	ACC205	USR201	New Business	Investor Network	2025-06-01 00:00:00	2025-08-15 00:00:00	2025-08-18 13:27:41.186177	salesforce	1002
006SC006	YC Batch Company	35000	Proposal/Price Quote	2025-10-15	65	ACC206	USR202	New Business	Y Combinator	2025-07-01 00:00:00	2025-08-16 00:00:00	2025-08-18 13:27:41.186177	salesforce	1002
006SC007	Tech Startup SMB	18000	Value Proposition	2025-11-01	45	ACC207	USR201	New Business	Cold Outreach	2025-07-15 00:00:00	2025-08-17 00:00:00	2025-08-18 13:27:41.186177	salesforce	1002
006SC008	Bootstrapped Company	28000	Qualification	2025-12-15	30	ACC208	USR202	New Business	Website	2025-08-01 00:00:00	2025-08-18 00:00:00	2025-08-18 13:27:41.186177	salesforce	1002
\.


--
-- Data for Name: hubspot_company; Type: TABLE DATA; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

COPY analytics_company_1748544793859.hubspot_company (id, name, domain, industry, employees, annual_revenue, city, state, country, lifecycle_stage, lead_status, created_date, last_modified_date, last_activity_date, loaded_at, source_system, company_id) FROM stdin;
HCOMD001	Content Marketing Co	content-marketing.co	Marketing	85	12000000	Austin	TX	USA	customer	closed	2024-09-25 00:00:00	2025-08-15 00:00:00	2025-08-12	2025-08-18 13:31:09.774491	hubspot	1748544793859
HCOMD002	Email Campaign Net	email-campaign.net	Technology	120	18000000	Portland	OR	USA	customer	closed	2024-11-10 00:00:00	2025-08-16 00:00:00	2025-08-13	2025-08-18 13:31:09.774491	hubspot	1748544793859
HCOMD003	SEO Organic Com	seo-organic.com	Marketing	65	8000000	San Diego	CA	USA	salesqualifiedlead	qualified	2025-06-05 00:00:00	2025-08-18 00:00:00	2025-08-15	2025-08-18 13:31:09.774491	hubspot	1748544793859
HCOMD004	Social Media IO	social-media.io	Media	45	6000000	Nashville	TN	USA	salesqualifiedlead	inprogress	2025-06-25 00:00:00	2025-08-18 00:00:00	2025-08-16	2025-08-18 13:31:09.774491	hubspot	1748544793859
\.


--
-- Data for Name: hubspot_contact; Type: TABLE DATA; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

COPY analytics_company_1748544793859.hubspot_contact (id, firstname, lastname, email, phone, jobtitle, company, industry, lifecycle_stage, lead_status, original_source, created_date, last_modified_date, last_activity_date, email_opens, email_clicks, form_submissions, loaded_at, source_system, company_id) FROM stdin;
HCMD001	Catherine	Lee	clee@content-marketing.co	555-3201	VP Marketing	Content Marketing Co	Marketing	customer	closed	Blog Content	2024-09-25 00:00:00	2025-08-15 00:00:00	2025-08-12	52	15	9	2025-08-18 13:31:09.770648	hubspot	1748544793859
HCMD002	Steven	Garcia	sgarcia@email-campaign.net	555-3202	Digital Marketing Director	Email Campaign Net	Technology	customer	closed	Email Marketing	2024-11-10 00:00:00	2025-08-16 00:00:00	2025-08-13	38	11	6	2025-08-18 13:31:09.770648	hubspot	1748544793859
HCMD003	Monica	Thompson	mthompson@webinar-leads.org	555-3203	Head of Growth	Webinar Leads Org	Education	customer	closed	Webinar	2024-12-05 00:00:00	2025-08-17 00:00:00	2025-08-14	29	8	7	2025-08-18 13:31:09.770648	hubspot	1748544793859
HCMD004	Brian	Miller	bmiller@seo-organic.com	555-3204	SEO Manager	SEO Organic Com	Marketing	salesqualifiedlead	qualified	Organic Search	2025-06-05 00:00:00	2025-08-18 00:00:00	2025-08-15	25	6	4	2025-08-18 13:31:09.770648	hubspot	1748544793859
HCMD005	Ashley	Young	ayoung@social-media.io	555-3205	Social Media Manager	Social Media IO	Media	salesqualifiedlead	inprogress	Social Media	2025-06-25 00:00:00	2025-08-18 00:00:00	2025-08-16	18	5	3	2025-08-18 13:31:09.770648	hubspot	1748544793859
HCMD006	Kevin	Lopez	klopez@ppc-campaign.co	555-3206	PPC Specialist	PPC Campaign Co	Advertising	marketingqualifiedlead	new	Paid Search	2025-07-10 00:00:00	2025-08-17 00:00:00	2025-08-14	14	3	2	2025-08-18 13:31:09.770648	hubspot	1748544793859
\.


--
-- Data for Name: hubspot_deal; Type: TABLE DATA; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

COPY analytics_company_1748544793859.hubspot_deal (id, dealname, amount, dealstage, closedate, probability, pipeline, dealtype, leadsource, created_date, last_modified_date, loaded_at, source_system, company_id) FROM stdin;
HSMD001	Content Marketing Success	75000	closedwon	2024-12-22	100	sales	newbusiness	Blog Content	2024-10-10 00:00:00	2024-12-22 00:00:00	2025-08-18 13:31:09.753769	hubspot	1748544793859
HSMD002	Email Campaign Conversion	45000	closedwon	2025-01-18	100	sales	newbusiness	Email Marketing	2024-11-20 00:00:00	2025-01-18 00:00:00	2025-08-18 13:31:09.753769	hubspot	1748544793859
HSMD003	Webinar Lead Conversion	65000	closedwon	2025-02-25	100	sales	newbusiness	Webinar	2024-12-15 00:00:00	2025-02-25 00:00:00	2025-08-18 13:31:09.753769	hubspot	1748544793859
HSMD004	SEO Organic Opportunity	125000	qualified	2025-10-10	70	sales	newbusiness	Organic Search	2025-06-10 00:00:00	2025-08-16 00:00:00	2025-08-18 13:31:09.753769	hubspot	1748544793859
HSMD005	Social Media Generated	85000	presentation	2025-09-20	50	sales	newbusiness	Social Media	2025-07-01 00:00:00	2025-08-17 00:00:00	2025-08-18 13:31:09.753769	hubspot	1748544793859
HSMD006	PPC Campaign Lead	110000	negotiation	2025-09-30	65	sales	newbusiness	Paid Search	2025-07-15 00:00:00	2025-08-18 00:00:00	2025-08-18 13:31:09.753769	hubspot	1748544793859
\.


--
-- Data for Name: jira_issue_types; Type: TABLE DATA; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

COPY analytics_company_1748544793859.jira_issue_types (avatarid, description, hierarchylevel, iconurl, id, name, scope, self, subtask, untranslatedname, loaded_at, source_system, company_id) FROM stdin;
10307	Epics track collections of related bugs, stories, and tasks.	1	https://sumersaulttech.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10307?size=medium	10037	Epic	{"type": "PROJECT", "project": {"id": "10033"}}	https://sumersaulttech.atlassian.net/rest/api/3/issuetype/10037	false	Epic	2025-08-18 17:20:11.743686	jira	1748544793859
10316	Subtasks track small pieces of work that are part of a larger task.	-1	https://sumersaulttech.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10316?size=medium	10038	Subtask	{"type": "PROJECT", "project": {"id": "10033"}}	https://sumersaulttech.atlassian.net/rest/api/3/issuetype/10038	true	Subtask	2025-08-18 17:20:11.743721	jira	1748544793859
10303	Bugs track problems or errors.	0	https://sumersaulttech.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10303?size=medium	10035	Bug	{"type": "PROJECT", "project": {"id": "10033"}}	https://sumersaulttech.atlassian.net/rest/api/3/issuetype/10035	false	Bug	2025-08-18 17:20:11.743741	jira	1748544793859
10315	Stories track functionality or features expressed as user goals.	0	https://sumersaulttech.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10315?size=medium	10036	Story	{"type": "PROJECT", "project": {"id": "10033"}}	https://sumersaulttech.atlassian.net/rest/api/3/issuetype/10036	false	Story	2025-08-18 17:20:11.743834	jira	1748544793859
10318	Tasks track small, distinct pieces of work.	0	https://sumersaulttech.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10318?size=medium	10034	Task	{"type": "PROJECT", "project": {"id": "10033"}}	https://sumersaulttech.atlassian.net/rest/api/3/issuetype/10034	false	Task	2025-08-18 17:20:11.743887	jira	1748544793859
\.


--
-- Data for Name: jira_priorities; Type: TABLE DATA; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

COPY analytics_company_1748544793859.jira_priorities (description, iconurl, id, name, self, statuscolor, loaded_at, source_system, company_id) FROM stdin;
This problem will block progress.	https://sumersaulttech.atlassian.net/images/icons/priorities/highest_new.svg	1	Highest	https://sumersaulttech.atlassian.net/rest/api/3/priority/1	#d04437	2025-08-18 17:20:11.538041	jira	1748544793859
Serious problem that could block progress.	https://sumersaulttech.atlassian.net/images/icons/priorities/high_new.svg	2	High	https://sumersaulttech.atlassian.net/rest/api/3/priority/2	#f15C75	2025-08-18 17:20:11.538052	jira	1748544793859
Has the potential to affect progress.	https://sumersaulttech.atlassian.net/images/icons/priorities/medium_new.svg	3	Medium	https://sumersaulttech.atlassian.net/rest/api/3/priority/3	#f79232	2025-08-18 17:20:11.53806	jira	1748544793859
Minor problem or easily worked around.	https://sumersaulttech.atlassian.net/images/icons/priorities/low_new.svg	4	Low	https://sumersaulttech.atlassian.net/rest/api/3/priority/4	#707070	2025-08-18 17:20:11.538065	jira	1748544793859
Trivial problem with little or no impact on progress.	https://sumersaulttech.atlassian.net/images/icons/priorities/lowest_new.svg	5	Lowest	https://sumersaulttech.atlassian.net/rest/api/3/priority/5	#999999	2025-08-18 17:20:11.53807	jira	1748544793859
\.


--
-- Data for Name: jira_projects; Type: TABLE DATA; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

COPY analytics_company_1748544793859.jira_projects (avatarurls, description, entityid, expand, id, isprivate, issuetypes, issuetypes_count, key, lead, lead_display_name, name, projectkeys, projectkeys_count, projecttypekey, properties, self, simplified, style, uuid, loaded_at, source_system, company_id) FROM stdin;
{'48x48': 'https://sumersaulttech.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10422', '24x24': 'https://sumersaulttech.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10422?size=small', '16x16': 'https://sumersaulttech.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10422?size=xsmall', '32x32': 'https://sumersaulttech.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10422?size=medium'}		65ffdf3e-5d66-485e-9085-a6191934e527	description,lead,issueTypes,url,projectKeys,permissions,insight	10033	false	[{'self': 'https://sumersaulttech.atlassian.net/rest/api/3/issuetype/10034', 'id': '10034', 'description': 'Tasks track small, distinct pieces of work.', 'iconUrl': 'https://sumersaulttech.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10318?size=medium', 'name': 'Task', 'subtask': False, 'avatarId': 10318, 'hierarchyLevel': 0}, {'self': 'https://sumersaulttech.atlassian.net/rest/api/3/issuetype/10035', 'id': '10035', 'description': 'Bugs track problems or errors.', 'iconUrl': 'https://sumersaulttech.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10303?size=medium', 'name': 'Bug', 'subtask': False, 'avatarId': 10303, 'hierarchyLevel': 0}, {'self': 'https://sumersaulttech.atlassian.net/rest/api/3/issuetype/10036', 'id': '10036', 'description': 'Stories track functionality or features expressed as user goals.', 'iconUrl': 'https://sumersaulttech.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10315?size=medium', 'name': 'Story', 'subtask': False, 'avatarId': 10315, 'hierarchyLevel': 0}, {'self': 'https://sumersaulttech.atlassian.net/rest/api/3/issuetype/10037', 'id': '10037', 'description': 'Epics track collections of related bugs, stories, and tasks.', 'iconUrl': 'https://sumersaulttech.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10307?size=medium', 'name': 'Epic', 'subtask': False, 'avatarId': 10307, 'hierarchyLevel': 1}, {'self': 'https://sumersaulttech.atlassian.net/rest/api/3/issuetype/10038', 'id': '10038', 'description': 'Subtasks track small pieces of work that are part of a larger task.', 'iconUrl': 'https://sumersaulttech.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10316?size=medium', 'name': 'Subtask', 'subtask': True, 'avatarId': 10316, 'hierarchyLevel': -1}]	5	SGSB	{'self': 'https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:714a8ece-780c-460f-8bbe-3982ba9164b8', 'accountId': '712020:714a8ece-780c-460f-8bbe-3982ba9164b8', 'accountType': 'atlassian', 'avatarUrls': {'48x48': 'https://secure.gravatar.com/avatar/770e8f67bb3351e58236c68c86e8d3db?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FNP-3.png', '24x24': 'https://secure.gravatar.com/avatar/770e8f67bb3351e58236c68c86e8d3db?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FNP-3.png', '16x16': 'https://secure.gravatar.com/avatar/770e8f67bb3351e58236c68c86e8d3db?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FNP-3.png', '32x32': 'https://secure.gravatar.com/avatar/770e8f67bb3351e58236c68c86e8d3db?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FNP-3.png'}, 'displayName': 'Noah Phillips', 'active': True}	Noah Phillips	Sumersault General Scrum Board	['SGSB']	1	software	{}	https://sumersaulttech.atlassian.net/rest/api/3/project/10033	true	next-gen	65ffdf3e-5d66-485e-9085-a6191934e527	2025-08-18 17:20:10.68666	jira	1748544793859
\.


--
-- Data for Name: jira_statuses; Type: TABLE DATA; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

COPY analytics_company_1748544793859.jira_statuses (description, iconurl, id, name, scope, self, statuscategory, untranslatedname, loaded_at, source_system, company_id) FROM stdin;
	https://sumersaulttech.atlassian.net/	10033	To Do	{"type": "PROJECT", "project": {"id": "10033"}}	https://sumersaulttech.atlassian.net/rest/api/3/status/10033	{"self": "https://sumersaulttech.atlassian.net/rest/api/3/statuscategory/2", "id": 2, "key": "new", "colorName": "blue-gray", "name": "To Do"}	To Do	2025-08-18 17:20:11.345179	jira	1748544793859
	https://sumersaulttech.atlassian.net/	10034	In Progress	{"type": "PROJECT", "project": {"id": "10033"}}	https://sumersaulttech.atlassian.net/rest/api/3/status/10034	{"self": "https://sumersaulttech.atlassian.net/rest/api/3/statuscategory/4", "id": 4, "key": "indeterminate", "colorName": "yellow", "name": "In Progress"}	In Progress	2025-08-18 17:20:11.345192	jira	1748544793859
	https://sumersaulttech.atlassian.net/	10035	Done	{"type": "PROJECT", "project": {"id": "10033"}}	https://sumersaulttech.atlassian.net/rest/api/3/status/10035	{"self": "https://sumersaulttech.atlassian.net/rest/api/3/statuscategory/3", "id": 3, "key": "done", "colorName": "green", "name": "Done"}	Done	2025-08-18 17:20:11.3452	jira	1748544793859
\.


--
-- Data for Name: jira_users; Type: TABLE DATA; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

COPY analytics_company_1748544793859.jira_users (accountid, accounttype, active, avatarurls, displayname, emailaddress, locale, self, loaded_at, source_system, company_id) FROM stdin;
712020:714a8ece-780c-460f-8bbe-3982ba9164b8	atlassian	true	{"48x48": "https://secure.gravatar.com/avatar/770e8f67bb3351e58236c68c86e8d3db?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FNP-3.png", "24x24": "https://secure.gravatar.com/avatar/770e8f67bb3351e58236c68c86e8d3db?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FNP-3.png", "16x16": "https://secure.gravatar.com/avatar/770e8f67bb3351e58236c68c86e8d3db?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FNP-3.png", "32x32": "https://secure.gravatar.com/avatar/770e8f67bb3351e58236c68c86e8d3db?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FNP-3.png"}	Noah Phillips	\N	en_US	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:714a8ece-780c-460f-8bbe-3982ba9164b8	2025-08-18 17:20:10.925503	jira	1748544793859
60e5a86a471e61006a4c51fd	app	true	{"48x48": "https://secure.gravatar.com/avatar/33d4f224cd83fc4ec3d32e132209baf4?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FMC-2.png", "24x24": "https://secure.gravatar.com/avatar/33d4f224cd83fc4ec3d32e132209baf4?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FMC-2.png", "16x16": "https://secure.gravatar.com/avatar/33d4f224cd83fc4ec3d32e132209baf4?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FMC-2.png", "32x32": "https://secure.gravatar.com/avatar/33d4f224cd83fc4ec3d32e132209baf4?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FMC-2.png"}	Microsoft Teams for Jira Cloud	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=60e5a86a471e61006a4c51fd	2025-08-18 17:20:10.925525	jira	1748544793859
557058:214cdd6a-ff93-4d8b-838b-62dfcf1a2a71	app	true	{"48x48": "https://secure.gravatar.com/avatar/5f14d72ea4c4ebb05e46175191444f71?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FT-2.png", "24x24": "https://secure.gravatar.com/avatar/5f14d72ea4c4ebb05e46175191444f71?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FT-2.png", "16x16": "https://secure.gravatar.com/avatar/5f14d72ea4c4ebb05e46175191444f71?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FT-2.png", "32x32": "https://secure.gravatar.com/avatar/5f14d72ea4c4ebb05e46175191444f71?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FT-2.png"}	Trello	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=557058:214cdd6a-ff93-4d8b-838b-62dfcf1a2a71	2025-08-18 17:20:10.925537	jira	1748544793859
5b6c7b3afbc68529c6c47967	app	true	{"48x48": "https://secure.gravatar.com/avatar/1ac15886f45477da1a8230e3c52df31e?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FSJ-2.png", "24x24": "https://secure.gravatar.com/avatar/1ac15886f45477da1a8230e3c52df31e?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FSJ-2.png", "16x16": "https://secure.gravatar.com/avatar/1ac15886f45477da1a8230e3c52df31e?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FSJ-2.png", "32x32": "https://secure.gravatar.com/avatar/1ac15886f45477da1a8230e3c52df31e?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FSJ-2.png"}	Statuspage for Jira	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=5b6c7b3afbc68529c6c47967	2025-08-18 17:20:10.925551	jira	1748544793859
557058:f58131cb-b67d-43c7-b30d-6b58d40bd077	app	true	{"48x48": "https://secure.gravatar.com/avatar/600529a9c8bfef89daa848e6db28ed2d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FAJ-0.png", "24x24": "https://secure.gravatar.com/avatar/600529a9c8bfef89daa848e6db28ed2d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FAJ-0.png", "16x16": "https://secure.gravatar.com/avatar/600529a9c8bfef89daa848e6db28ed2d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FAJ-0.png", "32x32": "https://secure.gravatar.com/avatar/600529a9c8bfef89daa848e6db28ed2d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FAJ-0.png"}	Automation for Jira	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=557058:f58131cb-b67d-43c7-b30d-6b58d40bd077	2025-08-18 17:20:10.925567	jira	1748544793859
5d53f3cbc6b9320d9ea5bdc2	app	true	{"48x48": "https://secure.gravatar.com/avatar/40cff14f727dbf6d865576d575c6bdd2?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJO-4.png", "24x24": "https://secure.gravatar.com/avatar/40cff14f727dbf6d865576d575c6bdd2?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJO-4.png", "16x16": "https://secure.gravatar.com/avatar/40cff14f727dbf6d865576d575c6bdd2?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJO-4.png", "32x32": "https://secure.gravatar.com/avatar/40cff14f727dbf6d865576d575c6bdd2?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJO-4.png"}	Jira Outlook	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=5d53f3cbc6b9320d9ea5bdc2	2025-08-18 17:20:10.925578	jira	1748544793859
5cb4ae0e4b97ab11a18e00c7	app	true	{"48x48": "https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/5cb4ae0e4b97ab11a18e00c7/0c3fec9a-029d-422f-8586-89bc4ac2fe7e/48", "24x24": "https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/5cb4ae0e4b97ab11a18e00c7/0c3fec9a-029d-422f-8586-89bc4ac2fe7e/24", "16x16": "https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/5cb4ae0e4b97ab11a18e00c7/0c3fec9a-029d-422f-8586-89bc4ac2fe7e/16", "32x32": "https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/5cb4ae0e4b97ab11a18e00c7/0c3fec9a-029d-422f-8586-89bc4ac2fe7e/32"}	Atlassian Assist	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=5cb4ae0e4b97ab11a18e00c7	2025-08-18 17:20:10.925589	jira	1748544793859
557058:0867a421-a9ee-4659-801a-bc0ee4a4487e	app	true	{"48x48": "https://secure.gravatar.com/avatar/ab3787cd0c16633ae050dff9d5ab15fc?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FS-0.png", "24x24": "https://secure.gravatar.com/avatar/ab3787cd0c16633ae050dff9d5ab15fc?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FS-0.png", "16x16": "https://secure.gravatar.com/avatar/ab3787cd0c16633ae050dff9d5ab15fc?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FS-0.png", "32x32": "https://secure.gravatar.com/avatar/ab3787cd0c16633ae050dff9d5ab15fc?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FS-0.png"}	Slack	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=557058:0867a421-a9ee-4659-801a-bc0ee4a4487e	2025-08-18 17:20:10.9256	jira	1748544793859
557058:950f9f5b-3d6d-4e1d-954a-21367ae9ac75	app	true	{"48x48": "https://secure.gravatar.com/avatar/726e9dfb98dfab7231aca0392486818d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJW-2.png", "24x24": "https://secure.gravatar.com/avatar/726e9dfb98dfab7231aca0392486818d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJW-2.png", "16x16": "https://secure.gravatar.com/avatar/726e9dfb98dfab7231aca0392486818d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJW-2.png", "32x32": "https://secure.gravatar.com/avatar/726e9dfb98dfab7231aca0392486818d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJW-2.png"}	Jira Service Management Widget	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=557058:950f9f5b-3d6d-4e1d-954a-21367ae9ac75	2025-08-18 17:20:10.925613	jira	1748544793859
5dd64082af96bc0efbe55103	app	true	{"48x48": "https://secure.gravatar.com/avatar/675673c3f473815508441d00933b1752?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FS-3.png", "24x24": "https://secure.gravatar.com/avatar/675673c3f473815508441d00933b1752?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FS-3.png", "16x16": "https://secure.gravatar.com/avatar/675673c3f473815508441d00933b1752?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FS-3.png", "32x32": "https://secure.gravatar.com/avatar/675673c3f473815508441d00933b1752?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FS-3.png"}	System	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=5dd64082af96bc0efbe55103	2025-08-18 17:20:10.925628	jira	1748544793859
63a22fb348b367d78a14c15b	app	true	{"48x48": "https://secure.gravatar.com/avatar/22d8b94cf93cb1e0e47e16960c8ac093?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FPM-0.png", "24x24": "https://secure.gravatar.com/avatar/22d8b94cf93cb1e0e47e16960c8ac093?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FPM-0.png", "16x16": "https://secure.gravatar.com/avatar/22d8b94cf93cb1e0e47e16960c8ac093?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FPM-0.png", "32x32": "https://secure.gravatar.com/avatar/22d8b94cf93cb1e0e47e16960c8ac093?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FPM-0.png"}	Proforma Migrator	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=63a22fb348b367d78a14c15b	2025-08-18 17:20:10.925638	jira	1748544793859
5cf112d31552030f1e3a5905	app	true	{"48x48": "https://secure.gravatar.com/avatar/92dbb0e2c4bdf7a4e079ce410ddb6029?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJS-2.png", "24x24": "https://secure.gravatar.com/avatar/92dbb0e2c4bdf7a4e079ce410ddb6029?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJS-2.png", "16x16": "https://secure.gravatar.com/avatar/92dbb0e2c4bdf7a4e079ce410ddb6029?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJS-2.png", "32x32": "https://secure.gravatar.com/avatar/92dbb0e2c4bdf7a4e079ce410ddb6029?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJS-2.png"}	Jira Spreadsheets	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=5cf112d31552030f1e3a5905	2025-08-18 17:20:10.925649	jira	1748544793859
630db2cd9796033b256bc349	app	true	{"48x48": "https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/630db2cd9796033b256bc349/4f3c075d-f5e0-4bef-a0c8-81181a2e1b5d/48", "24x24": "https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/630db2cd9796033b256bc349/4f3c075d-f5e0-4bef-a0c8-81181a2e1b5d/24", "16x16": "https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/630db2cd9796033b256bc349/4f3c075d-f5e0-4bef-a0c8-81181a2e1b5d/16", "32x32": "https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/630db2cd9796033b256bc349/4f3c075d-f5e0-4bef-a0c8-81181a2e1b5d/32"}	Atlas for Jira Cloud	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=630db2cd9796033b256bc349	2025-08-18 17:20:10.925659	jira	1748544793859
712020:11553112-37bd-42e1-9e7b-60eb2242e74a	atlassian	true	{"48x48": "https://secure.gravatar.com/avatar/f730bfc39903892c5d38434ad6290fd1?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRF-0.png", "24x24": "https://secure.gravatar.com/avatar/f730bfc39903892c5d38434ad6290fd1?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRF-0.png", "16x16": "https://secure.gravatar.com/avatar/f730bfc39903892c5d38434ad6290fd1?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRF-0.png", "32x32": "https://secure.gravatar.com/avatar/f730bfc39903892c5d38434ad6290fd1?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRF-0.png"}	Rena Frackt	\N	en_US	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:11553112-37bd-42e1-9e7b-60eb2242e74a	2025-08-18 17:20:10.92567	jira	1748544793859
712020:44f51f76-a2f3-40f3-922a-b029ef6ea518	atlassian	true	{"48x48": "https://secure.gravatar.com/avatar/2600c2303ce0c072d0ae01687f175112?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FM-4.png", "24x24": "https://secure.gravatar.com/avatar/2600c2303ce0c072d0ae01687f175112?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FM-4.png", "16x16": "https://secure.gravatar.com/avatar/2600c2303ce0c072d0ae01687f175112?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FM-4.png", "32x32": "https://secure.gravatar.com/avatar/2600c2303ce0c072d0ae01687f175112?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FM-4.png"}	mpatrikios	mpatrikios@sumersaulttech.com	en_US	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:44f51f76-a2f3-40f3-922a-b029ef6ea518	2025-08-18 17:20:10.925682	jira	1748544793859
712020:4fd5b6b8-a4b3-4fcb-86c4-6952c10a923b	app	true	{"48x48": "https://secure.gravatar.com/avatar/4f98c62e12ba37af2761d0bd6ad4bd4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FGT-6.png", "24x24": "https://secure.gravatar.com/avatar/4f98c62e12ba37af2761d0bd6ad4bd4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FGT-6.png", "16x16": "https://secure.gravatar.com/avatar/4f98c62e12ba37af2761d0bd6ad4bd4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FGT-6.png", "32x32": "https://secure.gravatar.com/avatar/4f98c62e12ba37af2761d0bd6ad4bd4d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FGT-6.png"}	Global Translator	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:4fd5b6b8-a4b3-4fcb-86c4-6952c10a923b	2025-08-18 17:20:10.925692	jira	1748544793859
712020:b1648b41-3843-4cfa-8b3f-f05aef76d6ec	app	true	{"48x48": "https://secure.gravatar.com/avatar/f6af0fb33968af453d6b7947ee71e575?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCC-2.png", "24x24": "https://secure.gravatar.com/avatar/f6af0fb33968af453d6b7947ee71e575?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCC-2.png", "16x16": "https://secure.gravatar.com/avatar/f6af0fb33968af453d6b7947ee71e575?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCC-2.png", "32x32": "https://secure.gravatar.com/avatar/f6af0fb33968af453d6b7947ee71e575?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCC-2.png"}	Code Accessibility Checker	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:b1648b41-3843-4cfa-8b3f-f05aef76d6ec	2025-08-18 17:20:10.925701	jira	1748544793859
712020:adec57cb-5fd3-4a03-8a1d-8a794d3c2b2c	app	true	{"48x48": "https://secure.gravatar.com/avatar/e5966c45abd2c8eaf7bc161161b05794?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FUC-1.png", "24x24": "https://secure.gravatar.com/avatar/e5966c45abd2c8eaf7bc161161b05794?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FUC-1.png", "16x16": "https://secure.gravatar.com/avatar/e5966c45abd2c8eaf7bc161161b05794?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FUC-1.png", "32x32": "https://secure.gravatar.com/avatar/e5966c45abd2c8eaf7bc161161b05794?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FUC-1.png"}	Unit Test Creator	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:adec57cb-5fd3-4a03-8a1d-8a794d3c2b2c	2025-08-18 17:20:10.925714	jira	1748544793859
712020:61d9d164-9441-4de0-99cb-a2530a8bf9c8	app	true	{"48x48": "https://secure.gravatar.com/avatar/273bf2c8dbd01cfbcafbf4751a2fdb8b?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Fdefault-avatar-1.png", "24x24": "https://secure.gravatar.com/avatar/273bf2c8dbd01cfbcafbf4751a2fdb8b?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Fdefault-avatar-1.png", "16x16": "https://secure.gravatar.com/avatar/273bf2c8dbd01cfbcafbf4751a2fdb8b?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Fdefault-avatar-1.png", "32x32": "https://secure.gravatar.com/avatar/273bf2c8dbd01cfbcafbf4751a2fdb8b?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Fdefault-avatar-1.png"}	[TEMPLATE] ASCII art generator	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:61d9d164-9441-4de0-99cb-a2530a8bf9c8	2025-08-18 17:20:10.925724	jira	1748544793859
712020:caf853d4-bc7c-4544-88c1-ff54c0c97e90	app	true	{"48x48": "https://secure.gravatar.com/avatar/9baa6c474f1a6602277f67f363755281?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCC-2.png", "24x24": "https://secure.gravatar.com/avatar/9baa6c474f1a6602277f67f363755281?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCC-2.png", "16x16": "https://secure.gravatar.com/avatar/9baa6c474f1a6602277f67f363755281?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCC-2.png", "32x32": "https://secure.gravatar.com/avatar/9baa6c474f1a6602277f67f363755281?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCC-2.png"}	Comms Crafter	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:caf853d4-bc7c-4544-88c1-ff54c0c97e90	2025-08-18 17:20:10.925733	jira	1748544793859
712020:d3746098-f5b6-41a0-8d1b-5de0816ae6f2	app	true	{"48x48": "https://secure.gravatar.com/avatar/0faae2759563c4a4a96e9075ebbaa385?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FVU-2.png", "24x24": "https://secure.gravatar.com/avatar/0faae2759563c4a4a96e9075ebbaa385?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FVU-2.png", "16x16": "https://secure.gravatar.com/avatar/0faae2759563c4a4a96e9075ebbaa385?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FVU-2.png", "32x32": "https://secure.gravatar.com/avatar/0faae2759563c4a4a96e9075ebbaa385?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FVU-2.png"}	Vulnerable Dependency Updater	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:d3746098-f5b6-41a0-8d1b-5de0816ae6f2	2025-08-18 17:20:10.925743	jira	1748544793859
712020:df0a509c-3f27-437b-9ab6-b13730ea23b4	app	true	{"48x48": "https://secure.gravatar.com/avatar/2cf6d061979a986fcb6780dfb239b6e1?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCA-6.png", "24x24": "https://secure.gravatar.com/avatar/2cf6d061979a986fcb6780dfb239b6e1?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCA-6.png", "16x16": "https://secure.gravatar.com/avatar/2cf6d061979a986fcb6780dfb239b6e1?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCA-6.png", "32x32": "https://secure.gravatar.com/avatar/2cf6d061979a986fcb6780dfb239b6e1?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCA-6.png"}	ChatGPT Wrapper App	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:df0a509c-3f27-437b-9ab6-b13730ea23b4	2025-08-18 17:20:10.925753	jira	1748544793859
712020:c185547d-d117-43da-ad64-7707d8919d25	app	true	{"48x48": "https://secure.gravatar.com/avatar/4ea1fb737f7b172796e0d87ad650bae8?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCS-0.png", "24x24": "https://secure.gravatar.com/avatar/4ea1fb737f7b172796e0d87ad650bae8?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCS-0.png", "16x16": "https://secure.gravatar.com/avatar/4ea1fb737f7b172796e0d87ad650bae8?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCS-0.png", "32x32": "https://secure.gravatar.com/avatar/4ea1fb737f7b172796e0d87ad650bae8?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCS-0.png"}	Code Standardizer	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:c185547d-d117-43da-ad64-7707d8919d25	2025-08-18 17:20:10.925762	jira	1748544793859
712020:ed78106c-e844-40e5-bc9b-8b5927095c2b	app	true	{"48x48": "https://secure.gravatar.com/avatar/e0a7904c9df8e94c1ea1e1b1d43d8257?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FBA-5.png", "24x24": "https://secure.gravatar.com/avatar/e0a7904c9df8e94c1ea1e1b1d43d8257?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FBA-5.png", "16x16": "https://secure.gravatar.com/avatar/e0a7904c9df8e94c1ea1e1b1d43d8257?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FBA-5.png", "32x32": "https://secure.gravatar.com/avatar/e0a7904c9df8e94c1ea1e1b1d43d8257?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FBA-5.png"}	Basic Coding Agent	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:ed78106c-e844-40e5-bc9b-8b5927095c2b	2025-08-18 17:20:10.925772	jira	1748544793859
712020:73099d57-92ed-478b-a926-78a7bbc46b06	app	true	{"48x48": "https://secure.gravatar.com/avatar/0fffbc9813ebcc6f0d0de3141b2374c7?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FBA-1.png", "24x24": "https://secure.gravatar.com/avatar/0fffbc9813ebcc6f0d0de3141b2374c7?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FBA-1.png", "16x16": "https://secure.gravatar.com/avatar/0fffbc9813ebcc6f0d0de3141b2374c7?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FBA-1.png", "32x32": "https://secure.gravatar.com/avatar/0fffbc9813ebcc6f0d0de3141b2374c7?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FBA-1.png"}	Bug Report Assistant	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:73099d57-92ed-478b-a926-78a7bbc46b06	2025-08-18 17:20:10.925782	jira	1748544793859
712020:f02ec1e0-b3dd-4443-951d-bb039551e32c	app	true	{"48x48": "https://secure.gravatar.com/avatar/a8da464dea80f45702f07446fc908e2e?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCW-5.png", "24x24": "https://secure.gravatar.com/avatar/a8da464dea80f45702f07446fc908e2e?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCW-5.png", "16x16": "https://secure.gravatar.com/avatar/a8da464dea80f45702f07446fc908e2e?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCW-5.png", "32x32": "https://secure.gravatar.com/avatar/a8da464dea80f45702f07446fc908e2e?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCW-5.png"}	Code Documentation Writer	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:f02ec1e0-b3dd-4443-951d-bb039551e32c	2025-08-18 17:20:10.925792	jira	1748544793859
712020:198b328d-ca29-4386-a065-fd21c967c389	app	true	{"48x48": "https://secure.gravatar.com/avatar/cdda698237c5ac7a81c0a97c28322194?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FMC-3.png", "24x24": "https://secure.gravatar.com/avatar/cdda698237c5ac7a81c0a97c28322194?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FMC-3.png", "16x16": "https://secure.gravatar.com/avatar/cdda698237c5ac7a81c0a97c28322194?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FMC-3.png", "32x32": "https://secure.gravatar.com/avatar/cdda698237c5ac7a81c0a97c28322194?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FMC-3.png"}	Migration Config Changer	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:198b328d-ca29-4386-a065-fd21c967c389	2025-08-18 17:20:10.925802	jira	1748544793859
712020:b10c7f9e-8ba9-4c66-b025-2b5f508cb221	app	true	{"48x48": "https://secure.gravatar.com/avatar/c3d02e3e09cf7eb9a25b503202a9a9e6?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FBC-5.png", "24x24": "https://secure.gravatar.com/avatar/c3d02e3e09cf7eb9a25b503202a9a9e6?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FBC-5.png", "16x16": "https://secure.gravatar.com/avatar/c3d02e3e09cf7eb9a25b503202a9a9e6?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FBC-5.png", "32x32": "https://secure.gravatar.com/avatar/c3d02e3e09cf7eb9a25b503202a9a9e6?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FBC-5.png"}	Blocker Checker	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:b10c7f9e-8ba9-4c66-b025-2b5f508cb221	2025-08-18 17:20:10.925811	jira	1748544793859
712020:f5f80bc7-68d1-4430-847b-ce2fbc308090	app	true	{"48x48": "https://secure.gravatar.com/avatar/641414f5fc14180ce7d33e5a93e6d400?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FFC-2.png", "24x24": "https://secure.gravatar.com/avatar/641414f5fc14180ce7d33e5a93e6d400?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FFC-2.png", "16x16": "https://secure.gravatar.com/avatar/641414f5fc14180ce7d33e5a93e6d400?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FFC-2.png", "32x32": "https://secure.gravatar.com/avatar/641414f5fc14180ce7d33e5a93e6d400?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FFC-2.png"}	Feature Flag Cleaner	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:f5f80bc7-68d1-4430-847b-ce2fbc308090	2025-08-18 17:20:10.925821	jira	1748544793859
712020:0e559126-27c7-4bc6-85cf-5ee208b73ff9	app	true	{"48x48": "https://secure.gravatar.com/avatar/3690ab963dce618b41177aefb62706e2?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRA-2.png", "24x24": "https://secure.gravatar.com/avatar/3690ab963dce618b41177aefb62706e2?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRA-2.png", "16x16": "https://secure.gravatar.com/avatar/3690ab963dce618b41177aefb62706e2?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRA-2.png", "32x32": "https://secure.gravatar.com/avatar/3690ab963dce618b41177aefb62706e2?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRA-2.png"}	Root Cause Analyzer	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:0e559126-27c7-4bc6-85cf-5ee208b73ff9	2025-08-18 17:20:10.925831	jira	1748544793859
712020:30fb02f1-f796-4695-b862-512311f67e71	app	true	{"48x48": "https://secure.gravatar.com/avatar/5d2e88c2de6575ea6eaa84aab5908e6d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCO-6.png", "24x24": "https://secure.gravatar.com/avatar/5d2e88c2de6575ea6eaa84aab5908e6d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCO-6.png", "16x16": "https://secure.gravatar.com/avatar/5d2e88c2de6575ea6eaa84aab5908e6d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCO-6.png", "32x32": "https://secure.gravatar.com/avatar/5d2e88c2de6575ea6eaa84aab5908e6d?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCO-6.png"}	Code Observer	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:30fb02f1-f796-4695-b862-512311f67e71	2025-08-18 17:20:10.925841	jira	1748544793859
712020:1f8dd9ea-6061-4092-bfdb-0c97c5828aff	app	true	{"48x48": "https://secure.gravatar.com/avatar/cee418519ad06364e12e0a2182386d37?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FIO-3.png", "24x24": "https://secure.gravatar.com/avatar/cee418519ad06364e12e0a2182386d37?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FIO-3.png", "16x16": "https://secure.gravatar.com/avatar/cee418519ad06364e12e0a2182386d37?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FIO-3.png", "32x32": "https://secure.gravatar.com/avatar/cee418519ad06364e12e0a2182386d37?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FIO-3.png"}	Issue Organizer	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:1f8dd9ea-6061-4092-bfdb-0c97c5828aff	2025-08-18 17:20:10.925854	jira	1748544793859
712020:2ee3da7a-e086-45b0-afcd-c6c1f9995aab	app	true	{"48x48": "https://secure.gravatar.com/avatar/91976ce5b096b47ef3e316a120b4ab10?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJA-6.png", "24x24": "https://secure.gravatar.com/avatar/91976ce5b096b47ef3e316a120b4ab10?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJA-6.png", "16x16": "https://secure.gravatar.com/avatar/91976ce5b096b47ef3e316a120b4ab10?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJA-6.png", "32x32": "https://secure.gravatar.com/avatar/91976ce5b096b47ef3e316a120b4ab10?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJA-6.png"}	Jira Theme Analyzer	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:2ee3da7a-e086-45b0-afcd-c6c1f9995aab	2025-08-18 17:20:10.925864	jira	1748544793859
712020:08cc39c1-9c0b-419b-bb2a-829811956668	app	true	{"48x48": "https://secure.gravatar.com/avatar/db6ebea88bd8ce5f40a3b11cdabbae1f?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCI-6.png", "24x24": "https://secure.gravatar.com/avatar/db6ebea88bd8ce5f40a3b11cdabbae1f?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCI-6.png", "16x16": "https://secure.gravatar.com/avatar/db6ebea88bd8ce5f40a3b11cdabbae1f?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCI-6.png", "32x32": "https://secure.gravatar.com/avatar/db6ebea88bd8ce5f40a3b11cdabbae1f?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FCI-6.png"}	Customer Insights	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:08cc39c1-9c0b-419b-bb2a-829811956668	2025-08-18 17:20:10.925874	jira	1748544793859
712020:a49ab6fe-1370-4cc3-9963-37b52297e98f	app	true	{"48x48": "https://secure.gravatar.com/avatar/ec713a968545781674743e19a0c54766?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FDD-1.png", "24x24": "https://secure.gravatar.com/avatar/ec713a968545781674743e19a0c54766?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FDD-1.png", "16x16": "https://secure.gravatar.com/avatar/ec713a968545781674743e19a0c54766?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FDD-1.png", "32x32": "https://secure.gravatar.com/avatar/ec713a968545781674743e19a0c54766?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FDD-1.png"}	Decision director	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:a49ab6fe-1370-4cc3-9963-37b52297e98f	2025-08-18 17:20:10.925884	jira	1748544793859
712020:fd1a7a68-e4e0-4eee-80c4-71649740d17d	app	true	{"48x48": "https://secure.gravatar.com/avatar/b7c67720296f7d00734a33944d36227e?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FDI-4.png", "24x24": "https://secure.gravatar.com/avatar/b7c67720296f7d00734a33944d36227e?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FDI-4.png", "16x16": "https://secure.gravatar.com/avatar/b7c67720296f7d00734a33944d36227e?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FDI-4.png", "32x32": "https://secure.gravatar.com/avatar/b7c67720296f7d00734a33944d36227e?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FDI-4.png"}	Dashboard Insights	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:fd1a7a68-e4e0-4eee-80c4-71649740d17d	2025-08-18 17:20:10.925894	jira	1748544793859
712020:eeaf7377-958e-4ca4-9e22-e5c5589e5612	app	true	{"48x48": "https://secure.gravatar.com/avatar/ef9f3713a4ad7fb76d050f8a5fbe979c?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJW-0.png", "24x24": "https://secure.gravatar.com/avatar/ef9f3713a4ad7fb76d050f8a5fbe979c?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJW-0.png", "16x16": "https://secure.gravatar.com/avatar/ef9f3713a4ad7fb76d050f8a5fbe979c?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJW-0.png", "32x32": "https://secure.gravatar.com/avatar/ef9f3713a4ad7fb76d050f8a5fbe979c?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJW-0.png"}	Jira Workflow Wizard	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:eeaf7377-958e-4ca4-9e22-e5c5589e5612	2025-08-18 17:20:10.925904	jira	1748544793859
712020:857138f4-1232-4f33-88d2-a016af5d01f0	app	true	{"48x48": "https://secure.gravatar.com/avatar/ae2c734b44ccce694ef2bea1a8f8e7a9?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJA-6.png", "24x24": "https://secure.gravatar.com/avatar/ae2c734b44ccce694ef2bea1a8f8e7a9?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJA-6.png", "16x16": "https://secure.gravatar.com/avatar/ae2c734b44ccce694ef2bea1a8f8e7a9?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJA-6.png", "32x32": "https://secure.gravatar.com/avatar/ae2c734b44ccce694ef2bea1a8f8e7a9?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FJA-6.png"}	Job Listing Assistant	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:857138f4-1232-4f33-88d2-a016af5d01f0	2025-08-18 17:20:10.925913	jira	1748544793859
712020:aabc7213-a010-4395-a5bb-c7bbd754c8ec	app	true	{"48x48": "https://secure.gravatar.com/avatar/5833343a8dee74091a1bef212f599785?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FSH-1.png", "24x24": "https://secure.gravatar.com/avatar/5833343a8dee74091a1bef212f599785?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FSH-1.png", "16x16": "https://secure.gravatar.com/avatar/5833343a8dee74091a1bef212f599785?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FSH-1.png", "32x32": "https://secure.gravatar.com/avatar/5833343a8dee74091a1bef212f599785?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FSH-1.png"}	Service Request Helper	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:aabc7213-a010-4395-a5bb-c7bbd754c8ec	2025-08-18 17:20:10.925923	jira	1748544793859
712020:7987592f-096d-431e-94ab-05256fa67f60	app	true	{"48x48": "https://secure.gravatar.com/avatar/5bebfac6c2a114ae52ff6d0c33743e7b?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FME-1.png", "24x24": "https://secure.gravatar.com/avatar/5bebfac6c2a114ae52ff6d0c33743e7b?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FME-1.png", "16x16": "https://secure.gravatar.com/avatar/5bebfac6c2a114ae52ff6d0c33743e7b?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FME-1.png", "32x32": "https://secure.gravatar.com/avatar/5bebfac6c2a114ae52ff6d0c33743e7b?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FME-1.png"}	Marketplace App Expert	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:7987592f-096d-431e-94ab-05256fa67f60	2025-08-18 17:20:10.925933	jira	1748544793859
712020:e359e379-b453-47a1-928f-f34766142d7b	app	true	{"48x48": "https://secure.gravatar.com/avatar/945bafcf4237d0ed80a4bd8ef5db19b5?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FST-3.png", "24x24": "https://secure.gravatar.com/avatar/945bafcf4237d0ed80a4bd8ef5db19b5?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FST-3.png", "16x16": "https://secure.gravatar.com/avatar/945bafcf4237d0ed80a4bd8ef5db19b5?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FST-3.png", "32x32": "https://secure.gravatar.com/avatar/945bafcf4237d0ed80a4bd8ef5db19b5?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FST-3.png"}	Service Triage	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:e359e379-b453-47a1-928f-f34766142d7b	2025-08-18 17:20:10.925944	jira	1748544793859
712020:5fb644dd-b937-46be-a60e-3ec43d115355	app	true	{"48x48": "https://secure.gravatar.com/avatar/0102b452700b23195a254f0968b67643?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FOG-0.png", "24x24": "https://secure.gravatar.com/avatar/0102b452700b23195a254f0968b67643?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FOG-0.png", "16x16": "https://secure.gravatar.com/avatar/0102b452700b23195a254f0968b67643?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FOG-0.png", "32x32": "https://secure.gravatar.com/avatar/0102b452700b23195a254f0968b67643?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FOG-0.png"}	OKR Generator	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:5fb644dd-b937-46be-a60e-3ec43d115355	2025-08-18 17:20:10.925954	jira	1748544793859
712020:d170c154-4c6c-40d6-afff-27aca4fdfc62	app	true	{"48x48": "https://secure.gravatar.com/avatar/68c9a88fa874c70569c9827d3bb6253f?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FOG-1.png", "24x24": "https://secure.gravatar.com/avatar/68c9a88fa874c70569c9827d3bb6253f?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FOG-1.png", "16x16": "https://secure.gravatar.com/avatar/68c9a88fa874c70569c9827d3bb6253f?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FOG-1.png", "32x32": "https://secure.gravatar.com/avatar/68c9a88fa874c70569c9827d3bb6253f?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FOG-1.png"}	Ops Guide	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:d170c154-4c6c-40d6-afff-27aca4fdfc62	2025-08-18 17:20:10.925964	jira	1748544793859
712020:b4953acf-d05d-4abe-bfb2-9bedbb77b87f	app	true	{"48x48": "https://secure.gravatar.com/avatar/54ad8c368104e00d95cee5e0fb7f273a?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FPG-5.png", "24x24": "https://secure.gravatar.com/avatar/54ad8c368104e00d95cee5e0fb7f273a?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FPG-5.png", "16x16": "https://secure.gravatar.com/avatar/54ad8c368104e00d95cee5e0fb7f273a?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FPG-5.png", "32x32": "https://secure.gravatar.com/avatar/54ad8c368104e00d95cee5e0fb7f273a?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FPG-5.png"}	Product Requirements Guide	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:b4953acf-d05d-4abe-bfb2-9bedbb77b87f	2025-08-18 17:20:10.925973	jira	1748544793859
712020:4cb7475a-633d-4673-97a8-d069239abb44	app	true	{"48x48": "https://secure.gravatar.com/avatar/e13be988e6363123327e583ea6466af6?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FPT-5.png", "24x24": "https://secure.gravatar.com/avatar/e13be988e6363123327e583ea6466af6?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FPT-5.png", "16x16": "https://secure.gravatar.com/avatar/e13be988e6363123327e583ea6466af6?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FPT-5.png", "32x32": "https://secure.gravatar.com/avatar/e13be988e6363123327e583ea6466af6?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FPT-5.png"}	Progress Tracker	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:4cb7475a-633d-4673-97a8-d069239abb44	2025-08-18 17:20:10.925982	jira	1748544793859
712020:6af5435e-3afe-4f48-bb16-78246439c282	app	true	{"48x48": "https://secure.gravatar.com/avatar/d003faece0861b0aaae18cf00d0744a0?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRC-2.png", "24x24": "https://secure.gravatar.com/avatar/d003faece0861b0aaae18cf00d0744a0?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRC-2.png", "16x16": "https://secure.gravatar.com/avatar/d003faece0861b0aaae18cf00d0744a0?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRC-2.png", "32x32": "https://secure.gravatar.com/avatar/d003faece0861b0aaae18cf00d0744a0?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRC-2.png"}	Readiness Checker	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:6af5435e-3afe-4f48-bb16-78246439c282	2025-08-18 17:20:10.925992	jira	1748544793859
712020:5c1d02a9-ddae-4af8-9ece-7ce7874e685e	app	true	{"48x48": "https://secure.gravatar.com/avatar/a868e2894ad72b79e60fee1a6678f7c5?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRD-3.png", "24x24": "https://secure.gravatar.com/avatar/a868e2894ad72b79e60fee1a6678f7c5?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRD-3.png", "16x16": "https://secure.gravatar.com/avatar/a868e2894ad72b79e60fee1a6678f7c5?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRD-3.png", "32x32": "https://secure.gravatar.com/avatar/a868e2894ad72b79e60fee1a6678f7c5?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRD-3.png"}	Release Notes Drafter	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:5c1d02a9-ddae-4af8-9ece-7ce7874e685e	2025-08-18 17:20:10.926002	jira	1748544793859
712020:303634f7-84f3-42c5-b278-eb9c63a47bbe	app	true	{"48x48": "https://secure.gravatar.com/avatar/20c19e5b5cd12f72ec0d9745fa101a57?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRE-4.png", "24x24": "https://secure.gravatar.com/avatar/20c19e5b5cd12f72ec0d9745fa101a57?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRE-4.png", "16x16": "https://secure.gravatar.com/avatar/20c19e5b5cd12f72ec0d9745fa101a57?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRE-4.png", "32x32": "https://secure.gravatar.com/avatar/20c19e5b5cd12f72ec0d9745fa101a57?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FRE-4.png"}	Rovo Expert	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:303634f7-84f3-42c5-b278-eb9c63a47bbe	2025-08-18 17:20:10.926023	jira	1748544793859
712020:fdf50043-6c8f-4c2b-a93d-6b6380170245	app	true	{"48x48": "https://secure.gravatar.com/avatar/d95002084c1eab5b2022e6c99e4b8d02?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FSW-6.png", "24x24": "https://secure.gravatar.com/avatar/d95002084c1eab5b2022e6c99e4b8d02?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FSW-6.png", "16x16": "https://secure.gravatar.com/avatar/d95002084c1eab5b2022e6c99e4b8d02?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FSW-6.png", "32x32": "https://secure.gravatar.com/avatar/d95002084c1eab5b2022e6c99e4b8d02?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FSW-6.png"}	Social Media Writer	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:fdf50043-6c8f-4c2b-a93d-6b6380170245	2025-08-18 17:20:10.926035	jira	1748544793859
712020:a6b68870-e205-4dd0-b5cd-938244c1a018	app	true	{"48x48": "https://secure.gravatar.com/avatar/92cc5be9e8023d30fa46a6f08a1df8ba?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTR-5.png", "24x24": "https://secure.gravatar.com/avatar/92cc5be9e8023d30fa46a6f08a1df8ba?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTR-5.png", "16x16": "https://secure.gravatar.com/avatar/92cc5be9e8023d30fa46a6f08a1df8ba?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTR-5.png", "32x32": "https://secure.gravatar.com/avatar/92cc5be9e8023d30fa46a6f08a1df8ba?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTR-5.png"}	Team Recap	\N	\N	https://sumersaulttech.atlassian.net/rest/api/3/user?accountId=712020:a6b68870-e205-4dd0-b5cd-938244c1a018	2025-08-18 17:20:10.926044	jira	1748544793859
\.


--
-- Data for Name: salesforce_contact; Type: TABLE DATA; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

COPY analytics_company_1748544793859.salesforce_contact (id, firstname, lastname, email, phone, title, accountid, department, leadsource, created_date, last_modified_date, last_activity_date, loaded_at, source_system, company_id) FROM stdin;
003MD001	Patricia	Johnson	pjohnson@enterprise-platform.com	555-3001	VP Technology	ACC_MD001	Technology	Website	2024-09-15 00:00:00	2025-08-15 00:00:00	2025-08-12	2025-08-18 13:31:09.746348	salesforce	1748544793859
003MD002	Michael	Chen	mchen@data-analytics.co	555-3002	Chief Data Officer	ACC_MD002	Analytics	Referral	2024-10-20 00:00:00	2025-08-16 00:00:00	2025-08-14	2025-08-18 13:31:09.746348	salesforce	1748544793859
003MD003	Lisa	Rodriguez	lrodriguez@custom-integration.net	555-3003	Integration Manager	ACC_MD003	IT	Trade Show	2024-11-25 00:00:00	2025-08-17 00:00:00	2025-08-15	2025-08-18 13:31:09.746348	salesforce	1748544793859
003MD004	David	Park	dpark@global-expansion.io	555-3004	Director of Operations	ACC_MD004	Operations	Partner Referral	2025-05-20 00:00:00	2025-08-18 00:00:00	2025-08-16	2025-08-18 13:31:09.746348	salesforce	1748544793859
003MD005	Jennifer	Williams	jwilliams@multi-year.com	555-3005	Procurement Manager	ACC_MD005	Procurement	Cold Call	2025-06-25 00:00:00	2025-08-18 00:00:00	2025-08-17	2025-08-18 13:31:09.746348	salesforce	1748544793859
\.


--
-- Data for Name: salesforce_lead; Type: TABLE DATA; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

COPY analytics_company_1748544793859.salesforce_lead (id, firstname, lastname, email, phone, title, company, industry, status, rating, leadsource, created_date, last_modified_date, converted_date, loaded_at, source_system, company_id) FROM stdin;
00QMD001	Robert	Taylor	rtaylor@tech-solutions.io	555-3101	CTO	Tech Solutions Inc	Technology	Working	Hot	Inbound	2025-08-01 00:00:00	2025-08-16 00:00:00	\N	2025-08-18 13:31:09.750148	salesforce	1748544793859
00QMD002	Amanda	Brown	abrown@manufacturing-tech.com	555-3102	IT Director	Manufacturing Tech Co	Manufacturing	Qualified	Warm	Website	2025-08-05 00:00:00	2025-08-17 00:00:00	\N	2025-08-18 13:31:09.750148	salesforce	1748544793859
00QMD003	James	Wilson	jwilson@financial-data.org	555-3103	Head of Analytics	Financial Data Corp	Financial Services	Nurturing	Warm	Social Media	2025-08-08 00:00:00	2025-08-18 00:00:00	\N	2025-08-18 13:31:09.750148	salesforce	1748544793859
\.


--
-- Data for Name: salesforce_opportunity; Type: TABLE DATA; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

COPY analytics_company_1748544793859.salesforce_opportunity (id, name, amount, stagename, closedate, probability, accountid, ownerid, type, leadsource, created_date, last_modified_date, loaded_at, source_system, company_id) FROM stdin;
006MD001	MIAS Enterprise Platform	185000	Closed Won	2024-12-15	100	ACC_MD001	USR_MD001	New Business	Website	2024-10-01 00:00:00	2024-12-15 00:00:00	2025-08-18 13:31:09.742417	salesforce	1748544793859
006MD002	Data Analytics Package	125000	Closed Won	2025-01-28	100	ACC_MD002	USR_MD002	New Business	Referral	2024-11-15 00:00:00	2025-01-28 00:00:00	2025-08-18 13:31:09.742417	salesforce	1748544793859
006MD003	Custom Integration Project	95000	Closed Won	2025-02-14	100	ACC_MD003	USR_MD001	New Business	Trade Show	2024-12-01 00:00:00	2025-02-14 00:00:00	2025-08-18 13:31:09.742417	salesforce	1748544793859
006MD004	Global Expansion Deal	275000	Negotiation/Review	2025-09-30	75	ACC_MD004	USR_MD001	New Business	Partner Referral	2025-06-01 00:00:00	2025-08-15 00:00:00	2025-08-18 13:31:09.742417	salesforce	1748544793859
006MD005	Multi-Year Subscription	165000	Proposal/Price Quote	2025-10-15	60	ACC_MD005	USR_MD002	New Business	Cold Call	2025-07-01 00:00:00	2025-08-16 00:00:00	2025-08-18 13:31:09.742417	salesforce	1748544793859
006MD006	Advanced Features Upsell	78000	Value Proposition	2025-11-01	45	ACC_MD006	USR_MD001	Upsell	Customer Success	2025-07-15 00:00:00	2025-08-17 00:00:00	2025-08-18 13:31:09.742417	salesforce	1748544793859
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: miapatrikios
--

COPY public.chat_messages (id, role, content, "timestamp", metadata) FROM stdin;
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: miapatrikios
--

COPY public.companies (id, name, slug, created_at, is_active) FROM stdin;
1001	TechCorp Solutions	techcorp	2025-08-18 13:26:32.246046	t
1002	StartupCo Inc	startupco	2025-08-18 13:26:32.246046	t
1003	Enterprise LLC	enterprise	2025-08-18 13:26:32.246046	t
1748544793859	MIAS_DATA	mias_data	2025-08-18 13:26:32.246046	t
\.


--
-- Data for Name: data_sources; Type: TABLE DATA; Schema: public; Owner: miapatrikios
--

COPY public.data_sources (id, company_id, name, type, status, connector_id, table_count, last_sync_at, config, credentials, sync_tables, sync_frequency, last_sync_records, last_sync_error, created_at, updated_at) FROM stdin;
1	1001	TechCorp Salesforce	salesforce	connected	sf_techcorp_001	3	2025-08-18 11:26:32.383906	\N	\N	{salesforce_opportunity,salesforce_contact,salesforce_lead}	daily	125	\N	2025-08-18 13:26:32.383906	2025-08-18 13:26:32.383906
2	1001	TechCorp HubSpot	hubspot	connected	hs_techcorp_001	3	2025-08-18 12:26:32.383906	\N	\N	{hubspot_deal,hubspot_contact,hubspot_company}	daily	195	\N	2025-08-18 13:26:32.383906	2025-08-18 13:26:32.383906
3	1001	TechCorp QuickBooks	quickbooks	connected	qb_techcorp_001	3	2025-08-18 12:56:32.383906	\N	\N	{quickbooks_invoice,quickbooks_expense,quickbooks_customer}	daily	255	\N	2025-08-18 13:26:32.383906	2025-08-18 13:26:32.383906
4	1002	StartupCo Salesforce	salesforce	connected	sf_startupco_001	3	2025-08-18 12:26:32.387059	\N	\N	{salesforce_opportunity,salesforce_contact,salesforce_lead}	daily	102	\N	2025-08-18 13:26:32.387059	2025-08-18 13:26:32.387059
5	1002	StartupCo Jira	jira	connected	jira_startupco_001	3	2025-08-18 13:11:32.387059	\N	\N	{jira_project,jira_issue,jira_user}	daily	158	\N	2025-08-18 13:26:32.387059	2025-08-18 13:26:32.387059
6	1003	Enterprise HubSpot	hubspot	connected	hs_enterprise_001	3	2025-08-18 12:41:32.387474	\N	\N	{hubspot_deal,hubspot_contact,hubspot_company}	daily	315	\N	2025-08-18 13:26:32.387474	2025-08-18 13:26:32.387474
7	1003	Enterprise QuickBooks	quickbooks	connected	qb_enterprise_001	3	2025-08-18 13:06:32.387474	\N	\N	{quickbooks_invoice,quickbooks_expense,quickbooks_customer}	daily	455	\N	2025-08-18 13:26:32.387474	2025-08-18 13:26:32.387474
8	1748544793859	MIAS Jira	jira	connected	jira_mias_001	5	2025-08-18 13:17:14.30776	\N	\N	{jira_projects,jira_users,jira_statuses,jira_priorities,jira_issue_types}	daily	64	\N	2025-08-18 13:27:14.30776	2025-08-18 13:27:14.30776
9	1748544793859	MIAS Salesforce	salesforce	connected	sf_mias_001	3	2025-08-18 13:02:14.30776	\N	\N	{salesforce_opportunity,salesforce_contact,salesforce_lead}	daily	80	\N	2025-08-18 13:27:14.30776	2025-08-18 13:27:14.30776
10	1748544793859	MIAS HubSpot	hubspot	connected	hs_mias_001	3	2025-08-18 12:52:14.30776	\N	\N	{hubspot_deal,hubspot_contact,hubspot_company}	daily	92	\N	2025-08-18 13:27:14.30776	2025-08-18 13:27:14.30776
\.


--
-- Data for Name: kpi_metrics; Type: TABLE DATA; Schema: public; Owner: miapatrikios
--

COPY public.kpi_metrics (id, company_id, name, description, value, change_percent, sql_query, yearly_goal, current_progress, goal_progress, goal_type, quarterly_goals, monthly_goals, category, priority, format, is_increasing, is_north_star, last_calculated_at) FROM stdin;
\.


--
-- Data for Name: metric_history; Type: TABLE DATA; Schema: public; Owner: miapatrikios
--

COPY public.metric_history (id, metric_id, value, recorded_at, period) FROM stdin;
\.


--
-- Data for Name: pipeline_activities; Type: TABLE DATA; Schema: public; Owner: miapatrikios
--

COPY public.pipeline_activities (id, type, description, status, "timestamp", metadata) FROM stdin;
\.


--
-- Data for Name: setup_status; Type: TABLE DATA; Schema: public; Owner: miapatrikios
--

COPY public.setup_status (id, warehouse_connected, data_sources_configured, models_deployed, total_models, last_updated) FROM stdin;
\.


--
-- Data for Name: sql_models; Type: TABLE DATA; Schema: public; Owner: miapatrikios
--

COPY public.sql_models (id, company_id, name, layer, sql_content, status, deployed_at, dependencies) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: miapatrikios
--

COPY public.users (id, username, password, company_id, role) FROM stdin;
\.


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: miapatrikios
--

SELECT pg_catalog.setval('public.chat_messages_id_seq', 1, false);


--
-- Name: data_sources_id_seq; Type: SEQUENCE SET; Schema: public; Owner: miapatrikios
--

SELECT pg_catalog.setval('public.data_sources_id_seq', 10, true);


--
-- Name: kpi_metrics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: miapatrikios
--

SELECT pg_catalog.setval('public.kpi_metrics_id_seq', 1, false);


--
-- Name: metric_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: miapatrikios
--

SELECT pg_catalog.setval('public.metric_history_id_seq', 1, false);


--
-- Name: pipeline_activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: miapatrikios
--

SELECT pg_catalog.setval('public.pipeline_activities_id_seq', 1, false);


--
-- Name: setup_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: miapatrikios
--

SELECT pg_catalog.setval('public.setup_status_id_seq', 1, false);


--
-- Name: sql_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: miapatrikios
--

SELECT pg_catalog.setval('public.sql_models_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: miapatrikios
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- Name: hubspot_company hubspot_company_pkey; Type: CONSTRAINT; Schema: analytics_company_1001; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1001.hubspot_company
    ADD CONSTRAINT hubspot_company_pkey PRIMARY KEY (id);


--
-- Name: hubspot_contact hubspot_contact_pkey; Type: CONSTRAINT; Schema: analytics_company_1001; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1001.hubspot_contact
    ADD CONSTRAINT hubspot_contact_pkey PRIMARY KEY (id);


--
-- Name: hubspot_deal hubspot_deal_pkey; Type: CONSTRAINT; Schema: analytics_company_1001; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1001.hubspot_deal
    ADD CONSTRAINT hubspot_deal_pkey PRIMARY KEY (id);


--
-- Name: quickbooks_customer quickbooks_customer_pkey; Type: CONSTRAINT; Schema: analytics_company_1001; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1001.quickbooks_customer
    ADD CONSTRAINT quickbooks_customer_pkey PRIMARY KEY (id);


--
-- Name: quickbooks_expense quickbooks_expense_pkey; Type: CONSTRAINT; Schema: analytics_company_1001; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1001.quickbooks_expense
    ADD CONSTRAINT quickbooks_expense_pkey PRIMARY KEY (id);


--
-- Name: quickbooks_invoice quickbooks_invoice_pkey; Type: CONSTRAINT; Schema: analytics_company_1001; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1001.quickbooks_invoice
    ADD CONSTRAINT quickbooks_invoice_pkey PRIMARY KEY (id);


--
-- Name: salesforce_contact salesforce_contact_pkey; Type: CONSTRAINT; Schema: analytics_company_1001; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1001.salesforce_contact
    ADD CONSTRAINT salesforce_contact_pkey PRIMARY KEY (id);


--
-- Name: salesforce_lead salesforce_lead_pkey; Type: CONSTRAINT; Schema: analytics_company_1001; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1001.salesforce_lead
    ADD CONSTRAINT salesforce_lead_pkey PRIMARY KEY (id);


--
-- Name: salesforce_opportunity salesforce_opportunity_pkey; Type: CONSTRAINT; Schema: analytics_company_1001; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1001.salesforce_opportunity
    ADD CONSTRAINT salesforce_opportunity_pkey PRIMARY KEY (id);


--
-- Name: jira_issue jira_issue_pkey; Type: CONSTRAINT; Schema: analytics_company_1002; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1002.jira_issue
    ADD CONSTRAINT jira_issue_pkey PRIMARY KEY (id);


--
-- Name: jira_project jira_project_pkey; Type: CONSTRAINT; Schema: analytics_company_1002; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1002.jira_project
    ADD CONSTRAINT jira_project_pkey PRIMARY KEY (id);


--
-- Name: jira_user jira_user_pkey; Type: CONSTRAINT; Schema: analytics_company_1002; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1002.jira_user
    ADD CONSTRAINT jira_user_pkey PRIMARY KEY (id);


--
-- Name: salesforce_contact salesforce_contact_pkey; Type: CONSTRAINT; Schema: analytics_company_1002; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1002.salesforce_contact
    ADD CONSTRAINT salesforce_contact_pkey PRIMARY KEY (id);


--
-- Name: salesforce_lead salesforce_lead_pkey; Type: CONSTRAINT; Schema: analytics_company_1002; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1002.salesforce_lead
    ADD CONSTRAINT salesforce_lead_pkey PRIMARY KEY (id);


--
-- Name: salesforce_opportunity salesforce_opportunity_pkey; Type: CONSTRAINT; Schema: analytics_company_1002; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1002.salesforce_opportunity
    ADD CONSTRAINT salesforce_opportunity_pkey PRIMARY KEY (id);


--
-- Name: hubspot_company hubspot_company_pkey; Type: CONSTRAINT; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1748544793859.hubspot_company
    ADD CONSTRAINT hubspot_company_pkey PRIMARY KEY (id);


--
-- Name: hubspot_contact hubspot_contact_pkey; Type: CONSTRAINT; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1748544793859.hubspot_contact
    ADD CONSTRAINT hubspot_contact_pkey PRIMARY KEY (id);


--
-- Name: hubspot_deal hubspot_deal_pkey; Type: CONSTRAINT; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1748544793859.hubspot_deal
    ADD CONSTRAINT hubspot_deal_pkey PRIMARY KEY (id);


--
-- Name: salesforce_contact salesforce_contact_pkey; Type: CONSTRAINT; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1748544793859.salesforce_contact
    ADD CONSTRAINT salesforce_contact_pkey PRIMARY KEY (id);


--
-- Name: salesforce_lead salesforce_lead_pkey; Type: CONSTRAINT; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1748544793859.salesforce_lead
    ADD CONSTRAINT salesforce_lead_pkey PRIMARY KEY (id);


--
-- Name: salesforce_opportunity salesforce_opportunity_pkey; Type: CONSTRAINT; Schema: analytics_company_1748544793859; Owner: miapatrikios
--

ALTER TABLE ONLY analytics_company_1748544793859.salesforce_opportunity
    ADD CONSTRAINT salesforce_opportunity_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: companies companies_slug_unique; Type: CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_slug_unique UNIQUE (slug);


--
-- Name: data_sources data_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.data_sources
    ADD CONSTRAINT data_sources_pkey PRIMARY KEY (id);


--
-- Name: kpi_metrics kpi_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.kpi_metrics
    ADD CONSTRAINT kpi_metrics_pkey PRIMARY KEY (id);


--
-- Name: metric_history metric_history_pkey; Type: CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.metric_history
    ADD CONSTRAINT metric_history_pkey PRIMARY KEY (id);


--
-- Name: pipeline_activities pipeline_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.pipeline_activities
    ADD CONSTRAINT pipeline_activities_pkey PRIMARY KEY (id);


--
-- Name: setup_status setup_status_pkey; Type: CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.setup_status
    ADD CONSTRAINT setup_status_pkey PRIMARY KEY (id);


--
-- Name: sql_models sql_models_name_unique; Type: CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.sql_models
    ADD CONSTRAINT sql_models_name_unique UNIQUE (name);


--
-- Name: sql_models sql_models_pkey; Type: CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.sql_models
    ADD CONSTRAINT sql_models_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: data_sources data_sources_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.data_sources
    ADD CONSTRAINT data_sources_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: kpi_metrics kpi_metrics_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.kpi_metrics
    ADD CONSTRAINT kpi_metrics_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: metric_history metric_history_metric_id_kpi_metrics_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.metric_history
    ADD CONSTRAINT metric_history_metric_id_kpi_metrics_id_fk FOREIGN KEY (metric_id) REFERENCES public.kpi_metrics(id);


--
-- Name: sql_models sql_models_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.sql_models
    ADD CONSTRAINT sql_models_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: users users_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: miapatrikios
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- PostgreSQL database dump complete
--

\unrestrict rX1X78r29PMZ0iIEZnJP05uhIyO2rW4Y71AxryzIvHh92rv5GmviiyxV4I3BccQ

