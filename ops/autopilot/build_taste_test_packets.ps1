param(
    [string]$ArtifactPath = "",
    [ValidateSet("pickfu", "useberry", "lyssna", "maze", "local_manual", "all")]
    [string]$Provider = "all",
    [string]$OutPath = "",
    [switch]$SyntheticPanel
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\signature_arena\A20AS_tripled_variants_top2_20260518"
}
if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\human_taste_network\A20AT_human_taste_network_20260518"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 60 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Write-TextFile {
    param([string]$Path, [string]$Text)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Text | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Test-UnsafeText {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
    return ($Text -match 'https?://(chatgpt|gemini|makersuite|aistudio)\.' -or
        $Text -match '(?i)(api[_-]?key|token|secret|password|ntfy\.sh/[A-Za-z0-9_-]{12,})')
}

function New-QuestionSet {
    param([string]$StudyType, [array]$VariantIds)
    $variantOptions = @($VariantIds + @("No preference"))
    switch ($StudyType) {
        "five_second_impression" {
            return @(
                [ordered]@{
                    question_id = "five_second_words"
                    prompt = "After seeing this UI for 5 seconds, which words best describe it?"
                    response_type = "multi_select"
                    options = @("premium", "clear", "confusing", "cheap", "intense", "calm", "generic", "memorable", "serious", "weird", "game-like", "professional")
                }
            )
        }
        "weirdness_rejection" {
            return @(
                [ordered]@{
                    question_id = "weirdness_rejection"
                    prompt = "Does this UI feel weird, confusing, or visually off-putting?"
                    response_type = "single_choice"
                    options = @("No", "Slightly", "Yes")
                }
            )
        }
        "preference" {
            return @(
                [ordered]@{
                    question_id = "variant_preference"
                    prompt = "Which variant would you rather use for a premium chess learning app?"
                    response_type = "single_choice"
                    options = $variantOptions
                }
            )
        }
        "board_readability" {
            return @(
                [ordered]@{
                    question_id = "board_readability"
                    prompt = "Can you read the chess board clearly?"
                    response_type = "single_choice"
                    options = @("Yes", "Mostly", "No")
                },
                [ordered]@{
                    question_id = "chess_training_clarity"
                    prompt = "Can you immediately understand this is a chess training interface?"
                    response_type = "single_choice"
                    options = @("Yes", "Mostly", "No")
                },
                [ordered]@{
                    question_id = "main_action_clarity"
                    prompt = "Can you tell where the main action is?"
                    response_type = "single_choice"
                    options = @("Yes", "Mostly", "No")
                }
            )
        }
        "learning_value" {
            return @(
                [ordered]@{
                    question_id = "learning_value"
                    prompt = "Which UI best helps you understand what to do next and improve at chess?"
                    response_type = "single_choice"
                    options = $variantOptions
                }
            )
        }
        default {
            return @(
                [ordered]@{
                    question_id = "local_owner_vote"
                    prompt = "Which variant should become the provisional owner taste winner?"
                    response_type = "single_choice"
                    options = $variantOptions
                },
                [ordered]@{
                    question_id = "owner_risk_note"
                    prompt = "What feels cheap, weird, confusing, or not NeuroChess enough?"
                    response_type = "free_text"
                    options = @()
                }
            )
        }
    }
}

function New-Packet {
    param(
        [string]$ProviderName,
        [string]$Mode,
        [string]$StudyType,
        [string]$SignatureId,
        [array]$Variants
    )
    $variantIds = @($Variants | ForEach-Object { [string]$_.variant_id })
    [ordered]@{
        schema_version = "taste_test_packet_v1"
        mission_id = "A20AT"
        source_mission = "A20AS"
        provider = $ProviderName
        mode = $Mode
        study_id = ("a20at_{0}_{1}_{2}" -f $ProviderName, $SignatureId, $StudyType)
        study_type = $StudyType
        validation_level = "LEVEL_0_INTERNAL"
        title = ("NeuroChess {0} {1}" -f $SignatureId, $StudyType)
        purpose = "Export-only human taste packet. It prepares a study but does not submit a paid platform run."
        human_claim_allowed = $false
        paid_submission_performed = $false
        primary_evidence_policy = "isolated_variant_screenshots_only"
        contact_sheet_primary_evidence_allowed = $false
        variants = @($Variants | ForEach-Object {
            [ordered]@{
                signature_id = [string]$_.signature_id
                variant_id = [string]$_.variant_id
                component_name = [string]$_.component_name
                variant_name = [string]$_.variant_name
                screenshot_path = [string]$_.primary_screenshot_path
                main_surface_screenshot_path = [string]$_.main_surface_screenshot_path
                learning_loop_stage = [string]$_.learning_loop_stage
                board_visible = [bool]$_.board_visible
                board_safety_status = [string]$_.board_safety_status
                evidence_quality_score = [int]$_.evidence_quality_score
            }
        })
        questions = @(New-QuestionSet -StudyType $StudyType -VariantIds $variantIds)
        pass_signals = [ordered]@{
            weirdness_rejection_yes_below = 0.15
            board_readability_above = 0.80
            preference_min_sample = 30
            stronger_sample_target = 50
            confidence_method = "wilson_lower_bound"
        }
        expected_answer_schema = [ordered]@{
            participant_id = "anonymous string"
            provider = $ProviderName
            study_id = "string"
            question_id = "string"
            signature_id = $SignatureId
            variant_id = "A|B|C"
            response = "string"
            rating = "number 0-5"
            free_text = "optional redacted text"
            timestamp = "optional ISO timestamp"
        }
        no_private_urls = $true
        no_secrets = $true
    }
}

$manifestPath = Join-Path $ArtifactPath "variant_evidence_manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "A20AS variant evidence manifest not found: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$variants = @($manifest.variants)
if ($variants.Count -lt 6) {
    throw "Expected six A20AS variants; found $($variants.Count)."
}

foreach ($variant in $variants) {
    foreach ($field in @("primary_screenshot_path", "main_surface_screenshot_path")) {
        $value = [string]$variant.$field
        if (Test-UnsafeText -Text $value) {
            throw "Unsafe evidence reference detected in $field for $($variant.signature_id)_$($variant.variant_id)."
        }
        if ($value -notmatch 'NeuroChess_QA_Artifacts') {
            throw "Screenshot reference is not external QA artifact path: $value"
        }
    }
}

$providerConfigs = @{
    pickfu = @{ mode = "export_only"; study_types = @("preference", "weirdness_rejection", "five_second_impression") }
    useberry = @{ mode = "export_only"; study_types = @("five_second_impression", "preference", "board_readability") }
    lyssna = @{ mode = "export_only"; study_types = @("five_second_impression", "weirdness_rejection", "learning_value", "board_readability") }
    maze = @{ mode = "export_only"; study_types = @("board_readability", "learning_value", "preference") }
    local_manual = @{ mode = "import_csv_json"; study_types = @("local_vote", "preference", "weirdness_rejection", "board_readability", "learning_value") }
}

$providers = if ($Provider -eq "all") { @("pickfu", "useberry", "lyssna", "maze", "local_manual") } else { @($Provider) }
$packetRoot = Join-Path $OutPath "provider_packets"
$createdPackets = @()

foreach ($providerName in $providers) {
    $config = $providerConfigs[$providerName]
    $providerDir = Join-Path $packetRoot $providerName
    New-Item -ItemType Directory -Force -Path $providerDir | Out-Null

    foreach ($group in @($variants | Group-Object -Property signature_id)) {
        $signatureId = [string]$group.Name
        $groupVariants = @($group.Group | Sort-Object -Property variant_id)
        foreach ($studyType in $config.study_types) {
            $packet = New-Packet -ProviderName $providerName -Mode $config.mode -StudyType $studyType -SignatureId $signatureId -Variants $groupVariants
            $jsonPath = Join-Path $providerDir ("{0}_{1}.json" -f $signatureId, $studyType)
            Write-JsonFile -Path $jsonPath -Payload $packet
            $createdPackets += $jsonPath

            $md = @(
                "# $($packet.title)",
                "",
                "Provider: $providerName",
                "Mode: $($config.mode)",
                "Validation level: LEVEL_0_INTERNAL until real owner or crowd results are imported.",
                "Paid submission performed: false",
                "Human majority claim allowed: false",
                "",
                "## Evidence",
                ($groupVariants | ForEach-Object { "- $($_.signature_id) $($_.variant_id): $($_.primary_screenshot_path)" }),
                "",
                "## Questions",
                ($packet.questions | ForEach-Object { "- $($_.question_id): $($_.prompt)" }),
                "",
                "Use isolated screenshots only. Do not use overview contact sheets as primary evidence."
            ) -join [Environment]::NewLine
            $mdPath = Join-Path $providerDir ("{0}_{1}.md" -f $signatureId, $studyType)
            Write-TextFile -Path $mdPath -Text $md
            $createdPackets += $mdPath
        }
    }
}

$localVoteSheet = [ordered]@{
    schema_version = "local_vote_sheet_v1"
    mission_id = "A20AT"
    source_mission = "A20AS"
    status = "CROWD_TEST_READY"
    human_data_status = "HUMAN_DATA_ABSENT"
    owner_vote_status = "NOT_IMPORTED"
    crowd_validation_status = "NOT_IMPORTED"
    no_human_claim_without_level_2 = $true
    variants = @($variants | Sort-Object signature_id, variant_id | ForEach-Object {
        [ordered]@{
            signature_id = [string]$_.signature_id
            variant_id = [string]$_.variant_id
            variant_name = [string]$_.variant_name
            screenshot_path = [string]$_.primary_screenshot_path
            main_surface_screenshot_path = [string]$_.main_surface_screenshot_path
            local_score = [double]$_.local_score
            board_safety_status = [string]$_.board_safety_status
            learning_loop_stage = [string]$_.learning_loop_stage
        }
    })
    vote_questions = @(
        "Which sacred_board_chamber variant should continue: A, B, C, or no preference?",
        "Which decision_feedback_language variant should continue: A, B, C, or no preference?",
        "Which variant feels cheap, weird, confusing, or too much?",
        "Which variant best supports chess learning rather than decoration?"
    )
}

Write-JsonFile -Path (Join-Path $OutPath "local_vote_sheet.json") -Payload $localVoteSheet
$voteMd = @(
    "# NeuroChess Local Vote Sheet",
    "",
    "Status: CROWD_TEST_READY",
    "Human data: HUMAN_DATA_ABSENT",
    "This sheet can collect owner or small-panel taste feedback. It cannot support a crowd majority claim.",
    "",
    "## Variants",
    ($localVoteSheet.variants | ForEach-Object { "- $($_.signature_id) $($_.variant_id) ($($_.variant_name)): $($_.screenshot_path)" }),
    "",
    "## Questions",
    ($localVoteSheet.vote_questions | ForEach-Object { "- $_" })
) -join [Environment]::NewLine
Write-TextFile -Path (Join-Path $OutPath "local_vote_sheet.md") -Text $voteMd

$syntheticPath = $null
if ($SyntheticPanel) {
    $synthetic = [ordered]@{
        schema_version = "synthetic_panel_report_v1"
        mission_id = "A20AT"
        status = "SYNTHETIC_PANEL_PROVISIONAL_ONLY"
        counts_as_human_validation = $false
        personas = @("general_user", "chess_beginner", "chess_intermediate", "premium_design_critic", "skeptical_user", "accessibility_sensitive_user")
        provisional_read = "Variant B remains the local provisional winner for both top signatures because it has the strongest A20AS local score and full evidence quality."
        forbidden_claims = @("human majority validated", "95% people like it")
    }
    $syntheticPath = Join-Path $OutPath "synthetic_panel_report.json"
    Write-JsonFile -Path $syntheticPath -Payload $synthetic
}

$result = [ordered]@{
    schema_version = "taste_packet_build_result_v1"
    mission_id = "A20AT"
    status = "TASTE_TEST_PACKETS_READY"
    artifact_path = $OutPath
    source_artifact_path = $ArtifactPath
    provider_packets_root = $packetRoot
    providers = $providers
    packet_count = $createdPackets.Count
    packets = $createdPackets
    local_vote_sheet_json = (Join-Path $OutPath "local_vote_sheet.json")
    local_vote_sheet_md = (Join-Path $OutPath "local_vote_sheet.md")
    synthetic_panel_report = $syntheticPath
    human_data_status = "HUMAN_DATA_ABSENT"
    validation_level = "LEVEL_0_INTERNAL"
    crowd_validation_claim_allowed = $false
    paid_submission_performed = $false
    screenshots_copied = $false
    screenshots_committed = $false
    no_private_urls = $true
    no_secrets = $true
}

Write-JsonFile -Path (Join-Path $OutPath "manifest.json") -Payload $result
$result | ConvertTo-Json -Depth 60
exit 0
