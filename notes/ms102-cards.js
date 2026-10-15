// MS-102 revision cards
// ---------------------------------------------------------------------------
// HOW TO ADD A CARD
// Copy the template below, paste it into the list, and fill it in.
//
//   {
//       id: 'short-unique-name',          // letters, numbers and dashes, never reused
//       topic: 'Roles & permissions',     // one of the TOPICS below
//       q: 'The question',
//       a: 'The answer. Put `code` in backticks.\nA new line starts a new paragraph.',
//       lab: ''                            // optional: what you did in your dev tenant
//   },
//
// The `lab` field is for examples from your own Microsoft 365 dev tenant.
// When it's filled in, the card shows a "From my dev tenant" box under the answer.
// Never paste real client names, domains, tenant IDs or passwords here: this
// file is public on the website.
// ---------------------------------------------------------------------------

window.MS102_TOPICS = [
    'Tenant setup',
    'Roles & permissions',
    'Identity & sync',
    'Threats & protection',
    'Purview & compliance'
];

window.MS102_CARDS = [

    // ----- Tenant setup -----
    {
        id: 'tenant-config-tasks',
        topic: 'Tenant setup',
        q: 'What four tasks make up configuring a Microsoft 365 tenant?',
        a: 'Set up the organisational profile, manage tenant subscriptions, manage services and add-ins, then complete the tenant configuration.',
        lab: ''
    },
    {
        id: 'tenant-custom-themes',
        topic: 'Tenant setup',
        q: 'How do you give a set of users a different custom theme?',
        a: 'You can\'t assign a theme to an individual user. Assign the custom theme to one or more Microsoft 365 groups, and members of those groups see it instead of the default theme.',
        lab: ''
    },
    {
        id: 'tenant-country',
        topic: 'Tenant setup',
        q: 'A company wants to change the country/region of its tenant. What has to happen?',
        a: 'The country/region decides which services are available, taxes and billing currency, and which datacentre hosts the tenant, so it can\'t simply be edited. They need to sign up for a new account in the new country/region and buy new subscriptions.',
        lab: ''
    },
    {
        id: 'tenant-licences',
        topic: 'Tenant setup',
        q: 'Where do you review active and deprovisioned licences?',
        a: 'Microsoft 365 admin center → Billing → Licenses → Subscriptions tab.',
        lab: ''
    },
    {
        id: 'tenant-private-marketplace',
        topic: 'Tenant setup',
        q: 'What does a private Azure Marketplace do, and what state is it in when you create it?',
        a: 'It controls which third-party products users can deploy. Users can still browse the whole catalogue but can only buy or deploy approved items.\nIt starts disabled, with one Default collection. Add approved items, then enable it. Microsoft apps are added automatically.',
        lab: ''
    },
    {
        id: 'tenant-sharing-restrictive',
        topic: 'Tenant setup',
        q: 'The organisation-level and site-level SharePoint sharing settings disagree. Which applies?',
        a: 'The more restrictive one. External sharing must be allowed at the organisation level before any site can use it. OneDrive can be the same as SharePoint or more restrictive, never less.',
        lab: ''
    },
    {
        id: 'tenant-sharing-levels',
        topic: 'Tenant setup',
        q: 'List the four external sharing levels for SharePoint and OneDrive, most open first.',
        a: 'Anyone → New and existing guests → Existing guests → Only people in your organisation.\nAnyone is the default for both SharePoint and OneDrive.',
        lab: ''
    },
    {
        id: 'tenant-sharing-who',
        topic: 'Tenant setup',
        q: 'Which roles can change organisation-level sharing settings for SharePoint and OneDrive?',
        a: 'Global Administrators and SharePoint Administrators.',
        lab: ''
    },
    {
        id: 'tenant-sharing-domains',
        topic: 'Tenant setup',
        q: 'How do you allow or block external sharing with specific domains using PowerShell?',
        a: '`Set-SPOTenant` with `-SharingDomainRestrictionMode`, plus either `-SharingAllowedDomainList` or `-SharingBlockedDomainList`.',
        lab: ''
    },
    {
        id: 'tenant-anyone-links',
        topic: 'Tenant setup',
        q: 'When can users create "Anyone with the link" links, and how can you limit them?',
        a: 'Only when external sharing is set to Anyone. You can require Anyone links to expire within a set number of days and restrict them to View only.\nIf you shorten the expiry, existing links are updated to the new limit. If you lengthen it, existing links keep their current expiry.',
        lab: ''
    },
    {
        id: 'tenant-file-requests',
        topic: 'Tenant setup',
        q: 'What do file requests need in order to work?',
        a: 'OneDrive sharing must be set to Anyone, and Anyone links need edit permissions: View and edit for files, View, edit and upload for folders.',
        lab: ''
    },
    {
        id: 'tenant-oversharing',
        topic: 'Tenant setup',
        q: 'Which People Picker option should you remove to cut down internal oversharing in SharePoint?',
        a: '"Everyone Except External Users". Removing it stops people sharing content with the whole organisation by accident.',
        lab: ''
    },
    {
        id: 'tenant-audit-check',
        topic: 'Tenant setup',
        q: 'How do you check unified audit logging is on, and turn it on if it isn\'t?',
        a: 'Check in Exchange Online PowerShell: `Get-AdminAuditLogConfig | Format-List UnifiedAuditLogIngestionEnabled`\nTurn it on: `Set-AdminAuditLogConfig -UnifiedAuditLogIngestionEnabled $true`, or in the Purview portal under Audit → "Start recording user and admin activity". It can take about an hour before searches return results.',
        lab: ''
    },
    {
        id: 'tenant-audit-retention',
        topic: 'Tenant setup',
        q: 'How long are audit records kept by default with Audit (Standard)?',
        a: '180 days. Longer retention depends on audit log retention policies and users\' licences.',
        lab: ''
    },

    // ----- Roles & permissions -----
    {
        id: 'roles-ga-count',
        topic: 'Roles & permissions',
        q: 'How many Global Administrators should a tenant have, and why?',
        a: 'At least two, so one can reset the other if they\'re locked out, and fewer than five, because every Global Admin is a high-value target.',
        lab: ''
    },
    {
        id: 'roles-least-privilege',
        topic: 'Roles & permissions',
        q: 'Someone only needs to reset users\' passwords. Which role should they get?',
        a: 'Least privilege: Helpdesk Administrator or Password Administrator, never Global Administrator.',
        lab: ''
    },
    {
        id: 'roles-best-practice',
        topic: 'Roles & permissions',
        q: 'Name the seven best practices for administrative roles.',
        a: 'Manage to least privilege. Use PIM for just-in-time access. Require MFA for all admins. Run recurring access reviews. Keep Global Admins under five. Assign Entra roles to groups. Use cloud-only accounts for Entra roles.',
        lab: ''
    },
    {
        id: 'roles-pim-eligible',
        topic: 'Roles & permissions',
        q: 'In Privileged Identity Management, what is an "eligible" assignment?',
        a: 'The user can use the role but it\'s inactive until they activate it, for a set length of time. This is just-in-time access, and it removes standing admin rights.',
        lab: ''
    },
    {
        id: 'roles-pra',
        topic: 'Roles & permissions',
        q: 'Which role manages PIM and other users\' role assignments?',
        a: 'Privileged Role Administrator.',
        lab: ''
    },
    {
        id: 'roles-groups',
        topic: 'Roles & permissions',
        q: 'Why assign an admin role to a group instead of to each person?',
        a: 'Assign the role to the group once and every member gets it. It\'s quicker, consistent, and access is managed through group membership. Example: a "Helpdesk Administrators" group with the Helpdesk Administrator role.',
        lab: ''
    },
    {
        id: 'roles-admin-units',
        topic: 'Roles & permissions',
        q: 'What is an administrative unit, and when would you use one?',
        a: 'A container of users, groups or devices used to limit where an admin role applies. Example: a university gives each school\'s IT team admin rights over only that school\'s users.',
        lab: ''
    },
    {
        id: 'roles-admin-units-licence',
        topic: 'Roles & permissions',
        q: 'What licences do administrative units need?',
        a: 'Microsoft Entra ID P1 for each administrative unit admin. Members only need Entra ID Free.',
        lab: ''
    },
    {
        id: 'roles-admin-units-nest',
        topic: 'Roles & permissions',
        q: 'Can administrative units be nested inside each other?',
        a: 'No.',
        lab: ''
    },
    {
        id: 'roles-portals',
        topic: 'Roles & permissions',
        q: 'Besides the Microsoft 365 admin center, which three portals have their own admin roles?',
        a: 'Microsoft Entra admin center (e.g. Identity Governance Administrator), Microsoft Defender portal (e.g. Security Administrator, Security Reader), and Microsoft Purview portal (e.g. Compliance Administrator).',
        lab: ''
    },

    // ----- Identity & sync -----
    {
        id: 'id-models',
        topic: 'Identity & sync',
        q: 'What are the two identity models for Microsoft 365?',
        a: 'Cloud-only: accounts exist only in Microsoft Entra ID.\nHybrid: accounts live in on-premises Active Directory and are synced to Entra ID. On-premises AD is the source of authority, so most changes are made there.',
        lab: ''
    },
    {
        id: 'id-connect-vs-cloud',
        topic: 'Identity & sync',
        q: 'Entra Connect Sync or Entra Cloud Sync: what\'s the difference?',
        a: 'Connect Sync runs on an on-premises server you maintain. It suits large, complex AD environments and supports password hash sync, device registration and AD FS integration.\nCloud Sync uses lightweight agents with configuration hosted by Microsoft. It syncs users, groups and contacts.',
        lab: ''
    },
    {
        id: 'id-auth-methods',
        topic: 'Identity & sync',
        q: 'What are the three sign-in methods for hybrid identity?',
        a: 'Password hash synchronisation (PHS), pass-through authentication (PTA) and federation (e.g. AD FS).\nPHS and PTA are "managed" authentication: Entra ID handles the sign-in. Federation hands it off to another identity provider.',
        lab: ''
    },
    {
        id: 'id-pta',
        topic: 'Identity & sync',
        q: 'How does pass-through authentication check a password?',
        a: 'Lightweight agents on on-premises servers check the password directly against on-premises Active Directory. For resilience, run more than one agent.',
        lab: ''
    },
    {
        id: 'id-phs-backup',
        topic: 'Identity & sync',
        q: 'Why does Microsoft recommend turning on password hash sync even if you use PTA or federation?',
        a: 'Resilience. PTA and federation depend on on-premises servers. If those fail, for example after a ransomware attack, you can switch to PHS and people can still sign in to Microsoft 365.',
        lab: ''
    },
    {
        id: 'id-adfs',
        topic: 'Identity & sync',
        q: 'Which standard does AD FS commonly use for single sign-on?',
        a: 'SAML (Security Assertion Markup Language), which securely exchanges sign-in information between organisations and apps.',
        lab: ''
    },

    // ----- Threats & protection -----
    {
        id: 'threat-spear-phishing',
        topic: 'Threats & protection',
        q: 'What is spear phishing?',
        a: 'A phishing attack aimed at specific people, rather than sent to large numbers of random users.',
        lab: ''
    },
    {
        id: 'threat-spoofing',
        topic: 'Threats & protection',
        q: 'What protects Exchange Online mailboxes from spoofed email by default?',
        a: 'Exchange Online Protection (EOP), which includes anti-spoofing protection for all Exchange Online mailboxes.',
        lab: ''
    },
    {
        id: 'threat-account-breach',
        topic: 'Threats & protection',
        q: 'Name key ways to reduce the risk of an account breach.',
        a: 'MFA, Microsoft Entra ID Protection (risky sign-in and risky user detection, with risk-based Conditional Access), least privilege, an incident response plan, and encryption plus DLP for sensitive data.',
        lab: ''
    },
    {
        id: 'threat-elevation',
        topic: 'Threats & protection',
        q: 'What are the best defences against elevation of privilege attacks?',
        a: 'MFA, especially on admin accounts. Keep the number of Global Admins small. Regularly review admin accounts and their activity with auditing and alerts.',
        lab: ''
    },
    {
        id: 'threat-exfiltration',
        topic: 'Threats & protection',
        q: 'How can you prevent data exfiltration from a tenant?',
        a: 'Protect accounts first, then use: access control lists with least privilege, external sharing policies, a data classification scheme, and Microsoft Purview DLP.',
        lab: ''
    },
    {
        id: 'threat-deletion',
        topic: 'Threats & protection',
        q: 'What\'s the key defence against malicious data deletion?',
        a: 'Layers of preventive and detective controls, plus backups of critical data stored offline that you know how to restore.',
        lab: ''
    },
    {
        id: 'threat-spillage',
        topic: 'Threats & protection',
        q: 'Confidential data was emailed to the wrong people. What tool do you use, and what are the steps?',
        a: 'An eDiscovery case. Steps: (optional) control who can access the case → create the case → search for the data → review the results → trace sharing with message trace → check mailboxes for holds → delete the data → re-run the search to verify, export reports and close the case.',
        lab: ''
    },

    // ----- Purview & compliance -----
    {
        id: 'pv-sit-vs-classifier',
        topic: 'Purview & compliance',
        q: 'Sensitive information types vs trainable classifiers: what\'s the difference?',
        a: 'Sensitive information types match patterns (regular expressions or functions), backed up by keywords, confidence levels and proximity.\nTrainable classifiers learn from examples of the content you care about instead of matching patterns.',
        lab: ''
    },
    {
        id: 'pv-explorers',
        topic: 'Purview & compliance',
        q: 'Content explorer vs activity explorer?',
        a: 'Content explorer shows which items are labelled or classified. Activity explorer shows what people are doing with labelled content.',
        lab: ''
    },
    {
        id: 'pv-sensitivity-labels',
        topic: 'Purview & compliance',
        q: 'What do sensitivity labels do?',
        a: 'Provide one labelling system across apps, services and devices. A label can encrypt content and add markings, and the protection stays with the content as it moves inside and outside the organisation.',
        lab: ''
    },
    {
        id: 'pv-dke',
        topic: 'Purview & compliance',
        q: 'When would you use Double Key Encryption?',
        a: 'When only your organisation must ever be able to decrypt the content, or when regulations require you to hold the keys within a geographical boundary.',
        lab: ''
    },
    {
        id: 'pv-ome',
        topic: 'Purview & compliance',
        q: 'What does Office 365 Message Encryption (OME) do?',
        a: 'Encrypts email messages and attachments sent to anyone, on any device, so only authorised recipients can read them.',
        lab: ''
    },
    {
        id: 'pv-endpoint-dlp',
        topic: 'Purview & compliance',
        q: 'How do you extend DLP to files on people\'s computers and in the Chrome browser?',
        a: 'Endpoint DLP covers Windows 10 or later devices. The Microsoft Compliance Extension extends DLP to Chrome.',
        lab: ''
    },
    {
        id: 'pv-retention-scope',
        topic: 'Purview & compliance',
        q: 'What can a retention policy be applied to?',
        a: 'Either all instances of a location (e.g. every mailbox or every SharePoint site) or specific instances (e.g. certain departments\' mailboxes or selected sites).',
        lab: ''
    },
    {
        id: 'pv-retention-perms',
        topic: 'Purview & compliance',
        q: 'Compliance staff need to manage retention policies but shouldn\'t be Global Admins. What do you do?',
        a: 'Add them to the Compliance Administrator role group in Microsoft Purview.',
        lab: ''
    },
    {
        id: 'pv-irm-workflow',
        topic: 'Purview & compliance',
        q: 'What are the stages of the insider risk management workflow?',
        a: 'Policies → Alerts → Triage → Investigate → Action.\nAt triage, an alert is resolved by opening a new case, adding it to an existing case, or dismissing it.',
        lab: ''
    },
    {
        id: 'pv-irm-scenarios',
        topic: 'Purview & compliance',
        q: 'Give three scenarios insider risk management is designed for.',
        a: 'Any three of: data theft by departing users; leaks of sensitive or confidential information; security policy violations; risk based on a user\'s position, access level or history; actions by disgruntled users.',
        lab: ''
    },
    {
        id: 'pv-ediscovery-locations',
        topic: 'Purview & compliance',
        q: 'Where can Microsoft Purview eDiscovery search?',
        a: 'Exchange mailboxes, OneDrive accounts, SharePoint sites, Microsoft Teams, Microsoft 365 Groups and Viva Engage (formerly Yammer).',
        lab: ''
    }
];
