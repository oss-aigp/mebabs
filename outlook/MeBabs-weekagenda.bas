Attribute VB_Name = "MeBabs"
' MeBabs: de agenda van de komende dagen opslaan als .ics-bestand in Downloads.
' Daarna in MeBabs: Vergaderingen > Importeer weekagenda.
Option Explicit

Public Sub MeBabsWeekagenda()
    Const DAGEN As Integer = 7                      ' aantal dagen vanaf vandaag
    Const BESTAND As String = "MeBabs weekagenda.ics"
    Dim map As String, pad As String
    Dim exporteur As Outlook.CalendarSharing

    On Error Resume Next
    map = CreateObject("Shell.Application").Namespace("shell:Downloads").Self.Path
    On Error GoTo Fout
    If map = "" Then map = Environ$("USERPROFILE") & "\Downloads"
    pad = map & "\" & BESTAND

    Set exporteur = Application.Session.GetDefaultFolder(olFolderCalendar).GetCalendarExporter
    With exporteur
        .CalendarDetail = olFullDetails
        .IncludeWholeCalendar = False
        .StartDate = Date
        .EndDate = Date + DAGEN - 1
        .IncludeAttachments = True                  ' bijlagen worden in MeBabs stukken
        .IncludePrivateDetails = True
        .RestrictToWorkingHours = False
    End With
    exporteur.SaveAsICal pad

    MsgBox "De agenda van de komende " & DAGEN & " dagen staat in:" & vbCrLf & pad & vbCrLf & vbCrLf & _
           "Ga in MeBabs naar Vergaderingen > Importeer weekagenda en kies dit bestand.", vbInformation, "MeBabs"
    Exit Sub
Fout:
    MsgBox "Opslaan is niet gelukt: " & Err.Description, vbExclamation, "MeBabs"
End Sub
