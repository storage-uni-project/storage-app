import { StyleSheet, View, Text, Image, TouchableOpacity, ToastAndroid, Platform, Alert, Modal } from "react-native";
import Popover from "react-native-popover-view";
import { Entypo } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import { AntDesign } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import Colors from "../utils/Colors";
import { fetchFile, downloadFile, deleteItem } from "../utils/ServerRequests";
import { FileCardType } from "../types/FileTypes";
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';

const pdfPreviewImage = require("../../assets/pdf-icon.png");
const noPreviewImage = require("../../assets/basic-file-icon.png");

interface FileCardProps extends FileCardType {
    cardRemovalHandler: () => void
}

const FileCard = (props: FileCardProps) => {
    const [previewImage, setPreviewImage] = useState<{ uri: string | any }>();
    const [fileType, setFileType] = useState<string>("unknown");
    const [settingsPopupVisible, setSettingsPopupVisible] = useState<boolean>(false);
    const [isPreviewVisible, setIsPreviewVisible] = useState<boolean>(false);
    const [pdfBase64, setPdfBase64] = useState<string | null>(null);

    useEffect(() => {
        if (props.fileType === "application/pdf") {
            const fetchPDF = async () => {
                try {
                    const base64PDF = await fetchFile(props.fileURL);
                    if (base64PDF) {
                        setPdfBase64(base64PDF);
                        console.log('PDF fetched:', base64PDF.substring(0, 50)); // Check if the PDF is fetched correctly
                    } else {
                        console.error('Failed to fetch PDF: No data received.');
                    }
                } catch (error) {
                    console.error('Error fetching PDF:', error);
                }
            };
            fetchPDF();
            setPreviewImage(pdfPreviewImage);
            setFileType("pdf");
        } else if (props.fileType.split("/")[0] === "image") {
            fetchImage();
            setFileType("image");
        } else {
            setPreviewImage(noPreviewImage);
        }
    }, [props.fileType, props.fileURL]);

    const fetchImage = () => {
        fetchFile(props.fileURL)
            .then(base64Image => {
                if (base64Image) {
                    setPreviewImage({ uri: base64Image });
                } else {
                    console.error('Failed to fetch image: No data received.');
                }
            })
            .catch(error => {
                console.error(error);
            });
    };

    const handleDownloadFile = () => {
        downloadFile(props.fileURL)
            .then(status => {
                setSettingsPopupVisible(false);
            })
            .catch(error => {
                console.error('Download File Error:', error);
                Alert.alert("Download Failed", "An unexpected error occurred while downloading the file.");
            });
    };

    const handleDeleteFile = () => {
        deleteItem(props.fileURL)
            .then(_ => {
                setSettingsPopupVisible(false);
                if (Platform.OS === "android") {
                    ToastAndroid.show("File deleted!", ToastAndroid.SHORT);
                } else {
                    Alert.alert("File deleted!");
                }
                props.cardRemovalHandler();
            })
            .catch(error => {
                Alert.alert("Deletion Failed!", `An error occurred while deleting the file.`);
            })
    };

    const displayFile = async () => {
        if (fileType === "pdf" && pdfBase64) {
            try {
                // Check for and remove the Base64 prefix if it exists
                const base64Prefix = "base64,";
                const base64Data = pdfBase64.includes(base64Prefix)
                    ? pdfBase64.split(base64Prefix)[1]
                    : pdfBase64;
                
                const localUri = `${FileSystem.documentDirectory}${props.fileName}`;
                await FileSystem.writeAsStringAsync(localUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
    
                if (Platform.OS === "android") {
                    const contentUri = await FileSystem.getContentUriAsync(localUri);
                    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
                        data: contentUri,
                        flags: 1,
                        type: "application/pdf"
                    });
                } else if (Platform.OS === "ios") {
                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(localUri);
                    } else {
                        Alert.alert("Error", "Sharing is not available on this device.");
                    }
                }
            } catch (error) {
                console.error("Error opening PDF:", error);
                Alert.alert("Error", "Failed to open PDF file.");
            }
        } else if (fileType === "image") {
            setIsPreviewVisible(true);
        }
    };
    

    return (
        <TouchableOpacity style={styles.container} onPress={displayFile}>
            <Image
                style={fileType === "image" ? styles.filePreview : styles.pdfPreview}
                source={previewImage}
                resizeMode="contain"
            />
            <View style={styles.fileInfos}>
                <Text style={styles.fileName}>{decodeURIComponent(props.fileName)}</Text>
                <View style={styles.tagPlaceHolder} />
            </View>

            <Popover
                isVisible={settingsPopupVisible}
                onRequestClose={() => setSettingsPopupVisible(false)}
                animationConfig={{
                    duration: 300
                }}
                from={(
                    <TouchableOpacity style={styles.openSettingsButton} onPress={() => { setSettingsPopupVisible(true) }}>
                        <Entypo name="dots-three-vertical" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                )}>
                <View style={styles.settingModal}>
                    <TouchableOpacity style={styles.settingButton} onPress={() => handleDownloadFile()}>
                        <Feather name="download" size={25} color={Colors.primary} />
                        <Text style={styles.settingText}>DOWNLOAD</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.settingButton} onPress={() => handleDeleteFile()}>
                        <AntDesign name="delete" size={25} color={Colors.primary} />
                        <Text style={styles.settingText}>LÖSCHEN</Text>
                    </TouchableOpacity>
                </View>
            </Popover>

            {isPreviewVisible && (
                <Modal visible={isPreviewVisible} animationType="slide">
                    {fileType === "image" ? (
                        <Image
                            style={styles.imagePreview}
                            source={previewImage}
                            resizeMode="contain"
                        />
                    ) : fileType === "pdf" ? (
                        <></>
                    ) : (
                        <Text>Error loading file</Text>
                    )}
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setIsPreviewVisible(false)}
                    >
                        <AntDesign name="closesquare" size={35} color={Colors.primary} />
                    </TouchableOpacity>
                </Modal>
            )}
        </TouchableOpacity>
    );
};


const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.surface,
        alignItems: "center",
        minHeight: 60,
        width: "100%",
        borderRadius: 3,
        borderWidth: 0,
        borderColor: Colors.surfaceOutline,
        display: "flex",
        flexDirection: "row",
        padding: 5,
        paddingLeft: 10,
        gap: 10,
    },
    filePreview: {
        flex: 1,
        aspectRatio: 1,
        objectFit: "cover",
        borderRadius: 3,
    },
    pdfPreview: {
        flex: 1,
        height: 35,
    },
    fileInfos: {
        flex: 6,
        display: "flex",
        gap: 5,
    },
    tagPlaceHolder: {
        flex: 1,
        backgroundColor: "#dfdfdf",
        height: 20,
    },
    fileName: {
        flex: 1,
        fontSize: 15,
        color: Colors.primary,
    },
    openSettingsButton: {
        flex: 1,
        alignItems: "center",
    },
    settingModal: {
        width: 250,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 10
    },
    settingButton: {
        flex: 1,
        borderRadius: 3,
        height: 75,
        backgroundColor: Colors.surface,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10
    },
    settingText: {
        fontWeight: "bold",
        color: Colors.primary,
        fontSize: 17
    },
    closeButton: {
        position: "absolute",
        top: 30,
        right: 30,
    },
    closeButtonText: {
        color: Colors.surface,
        fontWeight: "bold",
    },
    imagePreview: {
        flex: 1,
        resizeMode: 'contain'
    }
});

export default FileCard;
